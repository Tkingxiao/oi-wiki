import { Router } from 'express';
import { authenticateToken, requirePermission } from '../method/auth.js';
import { manualRefreshAvatar, getUserAvatar, syncUserAvatar } from '../services/avatarService.js';
import { queryOne, queryAll } from '../method/database.js';
import { createSuccessResponse, createErrorResponse } from '../method/business-utils.js';

const router = Router();

router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await manualRefreshAvatar(userId);

        if (result.success) {
            res.json(result);
        } else {
            res.status(result.code || 400).json(result);
        }
    } catch (error) {
        logger.error('手动刷新头像路由错误:', error);
        res.status(500).json(createErrorResponse('服务器错误', 500));
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (!userId) {
            return res.status(400).json(createErrorResponse('无效的用户ID', 400));
        }

        const avatar = getUserAvatar(userId);
        res.json(createSuccessResponse('获取头像成功', { avatar }));
    } catch (error) {
        logger.error('获取头像路由错误:', error);
        res.status(500).json(createErrorResponse('服务器错误', 500));
    }
});

router.get('/me/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = queryOne(
            'SELECT avatar, avatar_last_updated, bilibili_uid FROM user WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json(createErrorResponse('用户不存在', 404));
        }

        const now = Math.floor(Date.now() / 1000);
        const threeDays = 3 * 24 * 60 * 60;
        const canRefresh = !user.avatar_last_updated || (now - user.avatar_last_updated) >= threeDays;

        res.json(createSuccessResponse('获取头像状态成功', {
            avatar: user.avatar,
            avatarLastUpdated: user.avatar_last_updated,
            bilibiliUid: user.bilibili_uid,
            canRefresh,
            isLocal: user.avatar?.startsWith('/api/images/avatar/') || user.avatar?.startsWith('/images/avatar/')
        }));
    } catch (error) {
        logger.error('获取头像状态路由错误:', error);
        res.status(500).json(createErrorResponse('服务器错误', 500));
    }
});

router.post('/refresh-all', authenticateToken, requirePermission(1), async (req, res) => {
    try {
        logger.info('开始刷新所有用户头像...');

        const users = queryAll(
            'SELECT id, bilibili_uid, name FROM user WHERE bilibili_uid IS NOT NULL'
        );

        logger.info(`找到 ${users.length} 个有B站UID的用户`);

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;
        const results = [];

        for (const user of users) {
            try {
                const result = await syncUserAvatar(user.id, user.bilibili_uid, true);

                if (result.success) {
                    if (result.data?.updated) {
                        successCount++;
                        results.push({
                            userId: user.id,
                            name: user.name,
                            status: 'success',
                            avatar: result.data.avatar
                        });
                    } else {
                        skipCount++;
                        results.push({
                            userId: user.id,
                            name: user.name,
                            status: 'skipped',
                            message: result.message
                        });
                    }
                } else {
                    failCount++;
                    results.push({
                        userId: user.id,
                        name: user.name,
                        status: 'failed',
                        message: result.message
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                failCount++;
                logger.error(`刷新用户 ${user.id} 头像失败:`, err);
                results.push({
                    userId: user.id,
                    name: user.name,
                    status: 'error',
                    message: err.message
                });
            }
        }

        logger.info(`刷新所有头像完成: 成功=${successCount}, 跳过=${skipCount}, 失败=${failCount}`);

        res.json(createSuccessResponse('批量刷新完成', {
            total: users.length,
            success: successCount,
            skipped: skipCount,
            failed: failCount,
            results: results
        }));
    } catch (error) {
        logger.error('批量刷新头像路由错误:', error);
        res.status(500).json(createErrorResponse('服务器错误', 500));
    }
});

export default router;
