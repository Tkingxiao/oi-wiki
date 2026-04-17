import express from 'express';
import { getRoomInfo, getMasterInfo, getTopListNew } from '../services/bilibili.js';
import { getLiveDurationByMonth } from '../services/liveDuration.js';
import { sendSuccess, sendError } from '../method/response.js';
import db from '../components/sql.js';

const router = express.Router();

/**
 * 获取房间信息
 */
router.get('/room/v1/Room/get_info', async (req, res) => {
    try {
        const data = await getRoomInfo();
        if (data.code !== 0) {
            return res.status(500).json({ code: data.code, message: data.message || '获取房间信息失败' });
        }
        sendSuccess(res, data);
    } catch (error) {
        logger.error('获取房间信息失败:', error);
        res.status(500).json({ error: '获取房间信息失败' });
    }
});

/**
 * 获取主播信息
 */
router.get('/live_user/v1/Master/info', async (req, res) => {
    try {
        const data = await getMasterInfo();
        if (data.code !== 0) {
            return res.status(500).json({ code: data.code, message: data.message || '获取主播信息失败' });
        }
        sendSuccess(res, data);
    } catch (error) {
        logger.error('获取主播信息失败:', error);
        res.status(500).json({ error: '获取主播信息失败' });
    }
});

/**
 * 获取排行榜数据
 */
router.get('/xlive/app-room/v2/guardTab/topListNew', async (req, res) => {
    try {
        const data = await getTopListNew();
        if (data.code !== 0) {
            return res.status(500).json({ code: data.code, message: data.message || '获取排行榜数据失败' });
        }
        sendSuccess(res, data);
    } catch (error) {
        logger.error('获取排行榜数据失败:', error);
        res.status(500).json({ error: '获取排行榜数据失败' });
    }
});

/**
 * 获取直播记录
 * @param {string} month - 月份，格式：YYYY-MM，不传则获取当前月
 */
router.get('/live/duration', async (req, res) => {
    try {
        const { month } = req.query;
        const result = await getLiveDurationByMonth(month);
        sendSuccess(res, result);
    } catch (error) {
        logger.error('获取直播记录失败:', error);
        res.status(500).json({ error: '获取直播记录失败' });
    }
});

// ========== B站视频列表（前台展示） ==========
/**
 * 获取启用的B站视频列表
 * 返回 id, title, bvid, cover_url，按排序字段升序、id降序排列，最多5条
 */
router.get('/videos', async (req, res) => {
    try {
        const stmt = global.db.prepare(`
            SELECT id, title, bvid, cover_url 
            FROM bilibili_videos 
            WHERE status = 1 
            ORDER BY sort_order ASC, id DESC 
            LIMIT 5
        `);
        const videos = stmt.all();
        res.json(videos);
    } catch (error) {
        logger.error('获取B站视频列表失败:', error);
        res.status(500).json({ error: '获取视频列表失败' });
    }
});

export default router;