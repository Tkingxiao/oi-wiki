import express from 'express';
import { createSuccessResponse, createErrorResponse } from '../method/business-utils.js';
import { addClient, removeClient, notifyHallOccupantUpdate } from '../services/sseService.js';

const router = express.Router();
const OCCUPANT_KEY = 'cinema:occupants';
const OCCUPANT_TTL = 3600;

// ==================== SSE 连接端点 ====================
router.get('/occupants-stream/:hallId', (req, res) => {
    const hallId = parseInt(req.params.hallId, 10);
    if (hallId < 1 || hallId > 4 || isNaN(hallId)) {
        return res.status(400).json({ error: '无效的放映厅ID' });
    }

    // 设置 SSE 必需的响应头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*', // 根据需要调整
    });

    const clientId = `client-${Date.now()}-${Math.random()}`;
    const client = { id: clientId, res };
    addClient(hallId, client);

    // 连接建立后，立即发送一次当前状态
    (async () => {
        try {
            const data = await global.redis.get(OCCUPANT_KEY);
            const occupants = data ? JSON.parse(data) : [null, null, null, null];
            const occupant = occupants[hallId - 1];
            client.res.write(`data: ${JSON.stringify({ hall: hallId, occupant, timestamp: Date.now() })}\n\n`);
        } catch (err) {
            logger.error('[SSE] 获取初始状态失败:', err);
        }
    })();

    // 客户端断开连接时清理
    req.on('close', () => {
        removeClient(hallId, clientId);
    });
});

// ==================== 获取占用状态（保留给其他用途） ====================
router.get('/occupants', async (req, res) => {
    try {
        const data = await global.redis.get(OCCUPANT_KEY);
        const occupants = data ? JSON.parse(data) : [null, null, null, null];
        res.json(createSuccessResponse('获取成功', occupants));
    } catch (err) {
        logger.error('获取占用状态失败:', err);
        res.json(createErrorResponse('获取失败', 500));
    }
});

// ==================== 占用放映厅 ====================
router.post('/occupy', async (req, res) => {
    const { hall, bv, userId, userName, userAvatar } = req.body;
    if (!hall || hall < 1 || hall > 4) {
        return res.json(createErrorResponse('厅号无效', 400));
    }
    const index = hall - 1;
    const numericUserId = Number(userId);
    try {
        const data = await global.redis.get(OCCUPANT_KEY);
        let occupants = data ? JSON.parse(data) : [null, null, null, null];

        if (occupants[index] && occupants[index].id !== numericUserId) {
            return res.json({
                success: false,
                message: '已被占用',
                occupant: occupants[index]
            });
        }

        occupants[index] = {
            id: numericUserId,
            name: userName,
            avatar: userAvatar,
            bv,
            updatedAt: Date.now()
        };
        await global.redis.setex(OCCUPANT_KEY, OCCUPANT_TTL, JSON.stringify(occupants));

        // 主动推送状态更新给所有订阅了该厅的客户端
        notifyHallOccupantUpdate(hall, occupants[index]);

        res.json(createSuccessResponse('占用成功', { occupant: occupants[index] }));
    } catch (err) {
        logger.error('占用放映厅失败:', err);
        res.json(createErrorResponse('占用失败', 500));
    }
});

// ==================== 释放放映厅 ====================
router.post('/release', async (req, res) => {
    const { hall, userId } = req.body;
    if (!hall) return res.json(createErrorResponse('厅号无效', 400));
    const index = hall - 1;
    const numericUserId = Number(userId);
    try {
        const data = await global.redis.get(OCCUPANT_KEY);
        let occupants = data ? JSON.parse(data) : [null, null, null, null];
        if (occupants[index] && occupants[index].id === numericUserId) {
            occupants[index] = null;
            await global.redis.setex(OCCUPANT_KEY, OCCUPANT_TTL, JSON.stringify(occupants));
            // 主动推送状态更新（该厅已空闲）
            notifyHallOccupantUpdate(hall, null);
        }
        res.json(createSuccessResponse('释放成功'));
    } catch (err) {
        logger.error('释放放映厅失败:', err);
        res.json(createErrorResponse('释放失败', 500));
    }
});

// ==================== 刷新占用时间 ====================
router.post('/occupy/refresh', async (req, res) => {
    const { hall, userId } = req.body;
    if (!hall || hall < 1 || hall > 4) return res.json(createErrorResponse('厅号无效', 400));
    const index = hall - 1;
    const numericUserId = Number(userId);
    try {
        const data = await global.redis.get(OCCUPANT_KEY);
        if (!data) return res.json(createErrorResponse('无占用记录', 404));
        let occupants = JSON.parse(data);
        if (occupants[index] && occupants[index].id === numericUserId) {
            occupants[index].updatedAt = Date.now();
            await global.redis.setex(OCCUPANT_KEY, OCCUPANT_TTL, JSON.stringify(occupants));
            notifyHallOccupantUpdate(hall, occupants[index]);
            res.json(createSuccessResponse('刷新成功'));
        } else {
            res.json(createErrorResponse('占用者不匹配', 403));
        }
    } catch (err) {
        res.json(createErrorResponse('刷新失败', 500));
    }
});

// ==================== 获取所有放映厅视频列表 ====================
router.get('/halls', async (req, res) => {
    try {
        const halls = global.db.prepare('SELECT hall, bv, cover, title, updated_at FROM cinema_halls ORDER BY hall').all();
        const result = [null, null, null, null];
        halls.forEach(h => {
            if (h.hall >= 1 && h.hall <= 4) {
                result[h.hall - 1] = {
                    bv: h.bv,
                    cover: h.cover,
                    title: h.title,
                    updatedAt: h.updated_at
                };
            }
        });
        res.json(createSuccessResponse('获取成功', result));
    } catch (err) {
        logger.error('获取放映厅列表失败:', err);
        res.json(createErrorResponse('获取失败', 500));
    }
});

// ==================== 设置放映厅视频 ====================
router.post('/hall', async (req, res) => {
    const { hall, bv, cover, title } = req.body;
    console.log('设置放映厅:', hall, bv, cover, title)
    if (!hall || hall < 1 || hall > 4) {
        return res.json(createErrorResponse('厅号无效', 400));
    }
    try {
        // 检查是否有人正在占用该厅
        const data = await global.redis.get(OCCUPANT_KEY);
        const occupants = data ? JSON.parse(data) : [null, null, null, null];
        const occupant = occupants[hall - 1];
        if (occupant) {
            return res.json(createErrorResponse('该放映厅有人正在观看，无法更换内容', 400));
        }

        global.db.prepare('INSERT OR REPLACE INTO cinema_halls (hall, bv, cover, title, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run(hall, bv || null, cover || null, title || null, Date.now());
        console.log('设置放映厅成功')
        res.json(createSuccessResponse('设置成功'));
    } catch (err) {
        console.error('设置放映厅失败:', err);
        res.json(createErrorResponse('设置失败', 500));
    }
});

// ==================== 删除放映厅视频 ====================
router.delete('/hall/:hall', async (req, res) => {
    const hall = parseInt(req.params.hall, 10);
    if (!hall || hall < 1 || hall > 4) {
        return res.json(createErrorResponse('厅号无效', 400));
    }
    try {
        global.db.prepare('UPDATE cinema_halls SET bv = NULL, cover = NULL, title = NULL, updated_at = ? WHERE hall = ?')
            .run(Date.now(), hall);
        res.json(createSuccessResponse('删除成功'));
    } catch (err) {
        logger.error('删除放映厅失败:', err);
        res.json(createErrorResponse('删除失败', 500));
    }
});

export default router;