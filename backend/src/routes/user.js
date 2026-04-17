import express from 'express';
import { createRouteHandler } from '../method/route-helpers.js';
import { sendVerificationCode, verifyCode, register, login, updateAvatar } from '../services/user.js';
import { read_json } from '../method/read.js';
import { authenticateToken } from '../method/auth.js'; // 新增：导入认证中间件

const router = express.Router();

// 登录接口（无需修改，已支持B站UID/邮箱）
router.post('/login', createRouteHandler(async (req, res) => {
    const { accountNumber, password, token } = req.body;
    return await login(accountNumber, password, token);
}));

// 兼容前端请求路径的登录接口
router.post('/api/auth/login', createRouteHandler(async (req, res) => {
    const { accountNumber, password, token } = req.body;
    return await login(accountNumber, password, token);
}));

// 注册接口 - 接收 bilibili_uid, email, password, verificationCode
router.post('/register', createRouteHandler(async (req, res) => {
    const { bilibili_uid, email, password, verificationCode } = req.body;
    return await register(bilibili_uid, email, password, verificationCode);
}));

// 兼容前端请求路径的注册接口
router.post('/api/auth/register', createRouteHandler(async (req, res) => {
    const { bilibili_uid, email, password, verificationCode } = req.body;
    return await register(bilibili_uid, email, password, verificationCode);
}));

// 发送验证码接口（无需修改）
router.post('/sendVerification', createRouteHandler(async (req, res) => {
    const appConfig = read_json('configs', 'config');
    if (!global.emailTransporter) {
        return { success: false, message: '邮件服务不可用', code: 503 };
    }
    const { email } = req.body;
    return await sendVerificationCode(email, global.emailTransporter, appConfig);
}));

// 兼容前端请求路径的发送验证码接口
router.post('/api/auth/sendVerificationCode', createRouteHandler(async (req, res) => {
    const appConfig = read_json('configs', 'config');
    if (!global.emailTransporter) {
        return { success: false, message: '邮件服务不可用', code: 503 };
    }
    const { email } = req.body;
    return await sendVerificationCode(email, global.emailTransporter, appConfig);
}));

// 验证验证码接口（无需修改）
router.post('/verifyCode', createRouteHandler(async (req, res) => {
    const { email, code } = req.body;
    return await verifyCode(email, code);
}));

// 新增：更新头像接口（需要登录，每月限制一次）
router.post('/update-avatar', authenticateToken, createRouteHandler(async (req, res) => {
    const { bilibili_uid } = req.body;
    const userId = req.user.id; // 从认证中间件获取用户ID
    return await updateAvatar(userId, bilibili_uid);
}));

export default router;