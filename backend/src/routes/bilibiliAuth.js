import express from 'express';
import axios from 'axios';
import QRCode from 'qrcode';
import { authenticateToken, requirePermission } from '../method/auth.js';

const router = express.Router();

// 存储临时登录状态
const loginStates = new Map();

// 定期清理过期状态
setInterval(() => {
    const now = Date.now();
    for (const [key, state] of loginStates.entries()) {
        if (state.expireTime && now > state.expireTime) {
            loginStates.delete(key);
            console.log(`[B站授权] 清理过期二维码: ${key}`);
        }
    }
}, 30000);

// 从B站重定向URL中提取Cookie
function extractCookieFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        const sessdata = params.get('SESSDATA');
        const biliJct = params.get('bili_jct');
        const dedeUserId = params.get('DedeUserID');
        if (!sessdata) return '';
        const cookieParts = [];
        if (sessdata) cookieParts.push(`SESSDATA=${sessdata}`);
        if (biliJct) cookieParts.push(`bili_jct=${biliJct}`);
        if (dedeUserId) cookieParts.push(`DedeUserID=${dedeUserId}`);
        console.log(`[B站授权] 从URL提取到的Cookie: ${cookieParts.join('; ')}`);
        return cookieParts.join('; ');
    } catch (err) {
        console.error('[B站授权] 解析URL失败:', err);
        return '';
    }
}

// 生成二维码
router.get('/qrcode', authenticateToken, requirePermission(0), async (req, res) => {
    console.log('[B站授权] 收到生成二维码请求');
    try {
        console.log('[B站授权] 调用B站接口获取登录URL...');
        const response = await axios.get('https://passport.bilibili.com/qrcode/getLoginUrl', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('[B站授权] B站接口响应状态:', response.status);
        console.log('[B站授权] B站接口完整返回数据:', JSON.stringify(response.data));
        
        if (response.data.code !== 0) {
            throw new Error(response.data.message);
        }
        const { url, oauthKey } = response.data.data;
        const qrcode_key = oauthKey;
        console.log('[B站授权] 获取到的 qrcode_key:', qrcode_key);
        console.log('[B站授权] 获取到的二维码URL:', url);
        
        console.log('[B站授权] 开始生成二维码图片...');
        const qrImage = await QRCode.toDataURL(url);
        console.log('[B站授权] 二维码图片生成成功');
        
        loginStates.set(qrcode_key, { status: 'pending', expireTime: Date.now() + 120000 });
        console.log(`[B站授权] 已存储临时状态，key=${qrcode_key}，有效期120秒`);
        
        res.json({ qrcode_key, qrImage });
        console.log('[B站授权] 二维码生成完成，已返回响应');
    } catch (err) {
        console.error('[B站授权] 生成二维码失败:', err);
        res.status(500).json({ error: '生成二维码失败' });
    }
});

// 轮询登录状态（修复：改用 POST 方法）
router.get('/qrcode/status/:key', authenticateToken, requirePermission(0), async (req, res) => {
    const { key } = req.params;
    console.log(`[B站授权] 收到轮询请求，key=${key}`);
    
    const state = loginStates.get(key);
    if (!state) {
        console.log(`[B站授权] key=${key} 不存在或已过期，返回expired`);
        return res.json({ status: 'expired' });
    }
    if (state.status === 'success') {
        console.log(`[B站授权] key=${key} 状态已是success，直接返回`);
        return res.json({ status: 'success' });
    }
    
    try {
        console.log(`[B站授权] 调用B站轮询接口（POST），key=${key}`);
        const pollRes = await axios.post('https://passport.bilibili.com/qrcode/getLoginInfo',
            `qrcode_key=${key}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        const data = pollRes.data;
        console.log(`[B站授权] 轮询接口返回: code=${data.code}, 完整数据:`, JSON.stringify(data));
        
        if (data.code === 0) {
            console.log('[B站授权] 扫码成功，尝试提取Cookie');
            const redirectUrl = data.data?.url;
            let cookieString = '';
            if (redirectUrl) {
                console.log(`[B站授权] 重定向URL: ${redirectUrl}`);
                cookieString = extractCookieFromUrl(redirectUrl);
            }
            if (cookieString) {
                console.log('[B站授权] 成功提取Cookie，准备保存到数据库');
                const stmt = global.db.prepare('INSERT OR REPLACE INTO bilibili_account (id, cookie, update_time) VALUES (1, ?, ?)');
                stmt.run(cookieString, Math.floor(Date.now() / 1000));
                state.status = 'success';
                console.log('[B站授权] Cookie保存成功');
                res.json({ status: 'success' });
            } else {
                console.warn('[B站授权] 扫码成功但未提取到Cookie');
                state.status = 'failed';
                res.json({ status: 'failed', error: '未能获取Cookie' });
            }
        } else if (data.code === 86101) {
            console.log('[B站授权] 未扫码，返回pending');
            res.json({ status: 'pending' });
        } else if (data.code === 86038) {
            console.log('[B站授权] 二维码已过期');
            loginStates.delete(key);
            res.json({ status: 'expired' });
        } else {
            console.error(`[B站授权] 未知错误码: ${data.code}`);
            res.json({ status: 'failed' });
        }
    } catch (err) {
        console.error('[B站授权] 轮询请求异常:', err.message);
        if (err.response) {
            console.error('[B站授权] 错误响应状态:', err.response.status);
            console.error('[B站授权] 错误响应数据:', err.response.data);
        }
        res.json({ status: 'pending' });
    }
});

// 手动保存Cookie
router.post('/cookie', authenticateToken, requirePermission(0), (req, res) => {
    const { cookie } = req.body;
    console.log('[B站授权] 收到手动保存Cookie请求');
    if (!cookie) {
        console.warn('[B站授权] Cookie为空');
        return res.status(400).json({ error: '缺少cookie' });
    }
    const stmt = global.db.prepare('INSERT OR REPLACE INTO bilibili_account (id, cookie, update_time) VALUES (1, ?, ?)');
    stmt.run(cookie, Math.floor(Date.now() / 1000));
    console.log('[B站授权] 手动保存Cookie成功');
    res.json({ success: true });
});

// 获取当前Cookie（调试）
router.get('/cookie', authenticateToken, requirePermission(0), (req, res) => {
    console.log('[B站授权] 收到获取Cookie请求');
    const row = global.db.prepare('SELECT cookie, update_time FROM bilibili_account WHERE id = 1').get();
    res.json(row || {});
});

export default router;