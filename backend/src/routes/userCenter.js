import express from 'express';
import { authenticateToken } from '../method/auth.js';
import bcrypt from 'bcrypt';
import { syncUserAvatar } from '../services/avatarService.js';   // 从B站更新头像的服务

const router = express.Router();

function isStrongPassword(password) {
    const regex = /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,12}$/;
    return regex.test(password);
}

// ==================== 获取当前用户信息（包含大航海等级和粉丝牌等级） ====================
router.get('/me', authenticateToken, (req, res) => {
    const user = global.db.prepare(`
        SELECT 
            u.id, u.name, u.account_number, u.email, u.permission, u.is_banned, 
            u.avatar, u.bilibili_uid, u.bilibili_name, u.badge, u.custom_tag, u.create_time,
            COALESCE(gc.guard_level, 0) as guard_level,
            COALESCE(gc.medal_level, 0) as medal_level
        FROM user u
        LEFT JOIN guard_cache gc ON u.bilibili_uid = gc.uid
        WHERE u.id = ?
    `).get(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const checkinCount = global.db.prepare('SELECT COUNT(*) as total FROM checkin_records WHERE user_id = ?').get(req.user.id).total;
    const postCount = global.db.prepare('SELECT COUNT(*) as total FROM ga_post WHERE user_id = ? AND is_deleted = 0').get(req.user.id).total;
    res.json({ ...user, checkin_days: checkinCount, post_count: postCount });
});

// ==================== 修改密码 ====================
router.put('/me/password', authenticateToken, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写完整' });
    if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ error: '密码必须为8-12位，包含数字、字母和特殊符号' });
    }
    const user = global.db.prepare('SELECT password FROM user WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(401).json({ error: '原密码错误' });
    }
    const hashed = bcrypt.hashSync(newPassword, 10);
    global.db.prepare('UPDATE user SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ success: true });
});

// ==================== 获取用户动态列表 ====================
router.get('/me/posts', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const posts = global.db.prepare(`
        SELECT p.id, p.content, p.created_at, 
               (SELECT COUNT(*) FROM ga_post_image WHERE post_id = p.id) as image_count,
               (SELECT COUNT(*) FROM ga_post_like WHERE post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM ga_comment WHERE post_id = p.id AND is_deleted = 0) as comment_count
        FROM ga_post p
        WHERE p.user_id = ? AND p.is_deleted = 0
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, pageSize, offset);
    const total = global.db.prepare('SELECT COUNT(*) as total FROM ga_post WHERE user_id = ? AND is_deleted = 0').get(req.user.id).total;
    res.json({ data: posts, total, page, pageSize });
});

// ==================== 获取用户评论列表 ====================
router.get('/me/comments', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const comments = global.db.prepare(`
        SELECT c.id, c.content, c.image_url, c.created_at,
               p.id as post_id, p.content as post_content
        FROM ga_comment c
        JOIN ga_post p ON c.post_id = p.id
        WHERE c.user_id = ? AND c.is_deleted = 0
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, pageSize, offset);
    const total = global.db.prepare('SELECT COUNT(*) as total FROM ga_comment WHERE user_id = ? AND is_deleted = 0').get(req.user.id).total;
    res.json({ data: comments, total, page, pageSize });
});

// ==================== 退出登录 ====================
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ success: true });
});

// ==================== 从B站更新头像（3天一次，管理员无限制） ====================
router.post('/update-avatar', authenticateToken, async (req, res) => {
    const { bilibili_uid } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.permission <= 1;
    try {
        const result = await syncUserAvatar(userId, bilibili_uid, isAdmin);
        if (result.success) {
            res.json({ success: true, avatar: result.data.avatar, updated: result.data.updated });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (err) {
        console.error('更新头像失败:', err);
        res.status(500).json({ error: '更新头像失败' });
    }
});

export default router;