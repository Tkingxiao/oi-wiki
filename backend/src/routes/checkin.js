import express from 'express';
import { authenticateToken } from '../method/auth.js';

const router = express.Router();

// 打卡：同时写入记录表（永久）和心情表（当天，次日清空）
router.post('/', authenticateToken, async (req, res) => {
    const { mood, message } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const now = Math.floor(Date.now() / 1000);

    if (!mood) {
        return res.status(400).json({ error: '请选择心情' });
    }
    if (message && message.length > 50) {
        return res.status(400).json({ error: '留言不能超过50字' });
    }

    try {
        // 检查今日是否已打卡（从永久记录表查询）
        const existing = global.db.prepare(
            'SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?'
        ).get(userId, today);
        if (existing) {
            return res.status(400).json({ error: '今天已经打过卡了' });
        }

        // 插入永久打卡记录
        global.db.prepare(
            'INSERT INTO checkin_records (user_id, checkin_date, created_at) VALUES (?, ?, ?)'
        ).run(userId, today, now);

        // 插入心情消息（用于心情墙，每天清空）
        global.db.prepare(
            'INSERT INTO checkin_messages (user_id, mood, message, created_at) VALUES (?, ?, ?, ?)'
        ).run(userId, mood, message || '', now);

        // 可选：更新用户总打卡次数（如果字段存在）
        try {
            global.db.prepare('UPDATE user SET total_checkins = total_checkins + 1 WHERE id = ?').run(userId);
        } catch (ignore) {
            // 字段不存在则忽略
        }

        res.json({ success: true, message: '打卡成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '打卡失败' });
    }
});

// 获取打卡排行榜（从永久记录表统计，附带用户等级牌和大航海身份）
router.get('/rank', async (req, res) => {
    try {
        const rows = global.db.prepare(`
            SELECT 
                u.id, 
                u.name, 
                u.avatar, 
                u.badge,
                COALESCE(gc.guard_level, 0) as guard_level,
                COALESCE(gc.medal_level, 0) as medal_level,
                COUNT(r.id) as days
            FROM user u
            LEFT JOIN checkin_records r ON u.id = r.user_id
            LEFT JOIN guard_cache gc ON u.bilibili_uid = gc.uid
            GROUP BY u.id
            HAVING days > 0
            ORDER BY days DESC
            LIMIT 100
        `).all();
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取排行榜失败' });
    }
});

// 获取今日心情墙（从心情表读取，只显示当天数据）
router.get('/messages', async (req, res) => {
    // 获取今天的开始时间戳（0点）和结束时间戳（24点）
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const endOfDay = startOfDay + 86400; // 加一天

    try {
        const rows = global.db.prepare(`
            SELECT m.id, m.user_id, u.name, u.avatar, m.mood, m.message, m.created_at
            FROM checkin_messages m
            JOIN user u ON m.user_id = u.id
            WHERE m.created_at >= ? AND m.created_at < ?
            ORDER BY m.created_at DESC
        `).all(startOfDay, endOfDay);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取心情墙失败' });
    }
});

export default router;