import express from 'express';
import { createRouteHandler } from '../method/route-helpers.js';
import { queryAll } from '../method/database.js';
import {
    searchBilibiliVideos,
    getAuditedBvList,
    addAuditedBv,
    deleteAuditedBv,
    getHotVideos,              // 新增
    manualRefreshHotVideos,    // 新增
    submitBvForAudit,          // 新增
    getBilibiliVideoDetail     // 新增
} from '../services/bilibiliVideo.js';
import { authenticateToken, optionalAuth, requirePermission, PERMISSIONS } from '../method/auth.js';

const router = express.Router();

// 搜索B站视频（可选认证，未登录游客也可访问）
router.get('/search', optionalAuth, createRouteHandler(async (req, res) => {
    const { keyword, limit } = req.query;
    if (!keyword) {
        return { success: false, message: '缺少关键词', code: 400 };
    }
    const videos = await searchBilibiliVideos(keyword, parseInt(limit) || 10);
    return { success: true, data: videos };
}));

// 获取热门视频（播放量前四，带刷新状态）
router.get('/hot', optionalAuth, createRouteHandler(async (req, res) => {
    return await getHotVideos();
}));

// 手动刷新热门视频（管理员，15天冷却）
router.post('/hot/refresh',
    authenticateToken,
    requirePermission(PERMISSIONS.ADMIN),
    createRouteHandler(async (req, res) => {
        return await manualRefreshHotVideos(req.user.id);
    })
);

// 用户提交 BV 审核
router.post('/submit',
    authenticateToken,
    createRouteHandler(async (req, res) => {
        const { bv } = req.body;
        const userId = req.user.id;
        const userName = req.user.name;
        const userAvatar = req.user.avatar || '';
        const userPermission = req.user.permission;
        return await submitBvForAudit(userId, userName, userAvatar, bv, userPermission);
    })
);

// 获取审核通过的BV列表（所有登录用户可访问）
router.get('/audited-bvs', authenticateToken, createRouteHandler(async (req, res) => {
    logger.info(`[audited-bvs] 用户 ${req.user?.name || req.user?.id} 请求获取审核通过BV列表`);
    const result = await getAuditedBvList();
    logger.info(`[audited-bvs] 返回数据: ${JSON.stringify(result)}`);
    return result;
}));

// 调试接口：获取audited_bv表原始数据（管理员）
router.get('/audited-bvs/debug',
    authenticateToken,
    requirePermission(PERMISSIONS.ADMIN),
    createRouteHandler(async (req, res) => {
        try {
            const list = queryAll(`
                SELECT id, bv, note, created_at, updated_at
                FROM audited_bv
                ORDER BY created_at DESC
            `);
            const submissions = queryAll(`
                SELECT id, bv, status, note, created_at, updated_at
                FROM video_submissions
                ORDER BY created_at DESC
            `);
            return {
                success: true,
                data: {
                    audited_bv_count: list.length,
                    audited_bv_list: list,
                    submissions_count: submissions.length,
                    submissions_list: submissions
                }
            };
        } catch (error) {
            logger.error(`[audited-bvs/debug] 获取数据失败: ${error.message}`);
            return { success: false, message: '获取失败', code: 500 };
        }
    })
);

// 添加审核BV（仅管理员及以上）
router.post('/audited-bvs',
    authenticateToken,
    requirePermission(PERMISSIONS.ADMIN),
    createRouteHandler(async (req, res) => {
        const { bv, note } = req.body;
        return await addAuditedBv(bv, note);
    })
);

// 删除审核BV（仅管理员及以上）
router.delete('/audited-bvs/:id',
    authenticateToken,
    requirePermission(PERMISSIONS.ADMIN),
    createRouteHandler(async (req, res) => {
        const { id } = req.params;
        return await deleteAuditedBv(id);
    })
);

// 获取B站视频详情（带封面、标题、播放量等）
router.get('/detail/:bv',
    optionalAuth,
    createRouteHandler(async (req, res) => {
        const { bv } = req.params;
        return await getBilibiliVideoDetail(bv);
    })
);

export default router;