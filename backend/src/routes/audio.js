import express from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { queryOne } from '../method/database.js';
import { createPublicRoute, createAdminUploadRouteHandler, createRouteHandler } from '../method/route-helpers.js';
import { authenticateToken, optionalAuth } from '../method/auth.js';
import { uploadAudio, getAudiosGrouped, createAudioClassification, getAudiosForDownload } from '../services/audio.js';
import { recordPlayCount, getWeeklyPopularAudios, getTotalPopularAudios } from '../services/audioPlayCount.js';
import { packAudios } from '../method/pack.js';
import { read_json } from "../method/read.js"

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'data', 'document', 'audios');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`创建音频上传目录: ${uploadDir}`);
}

// 获取音声列表 (游客可访问) - 返回按分类分组的数据
router.get('/audios', ...createPublicRoute(getAudiosGrouped));

// 上传音声 (需要登录)
router.post('/audios', ...createAdminUploadRouteHandler({
    destination: uploadDir,
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['audio/mpeg', 'audio/mp3'],
    allowedExtensions: ['.mp3', '.MP3']
}, 'audio', async (req) => {
    const { name, classification_id, new_classification_name } = req.body;
    const file = req.file;

    if (!name?.trim()) {
        return { success: false, message: '音声名称不能为空', code: 400 };
    }

    let finalClassificationId;

    if (new_classification_name?.trim()) {
        const createResult = await createAudioClassification(new_classification_name.trim(), req.user.id, req.user.permission);
        if (!createResult.success) return createResult;
        finalClassificationId = createResult.data.classificationId;
    } else if (classification_id) {
        finalClassificationId = parseInt(classification_id);
        if (!finalClassificationId || finalClassificationId <= 0) {
            return { success: false, message: '无效的分类ID', code: 400 };
        }
    } else {
        return { success: false, message: '请提供分类ID或新分类名称', code: 400 };
    }

    const audioData = { name: name.trim(), classificationId: finalClassificationId };
    const result = await uploadAudio(file, audioData, req.user.id, req.user.permission);
    
    // 高权限用户（海葵王、超级管理员、管理员）上传的音声自动审核通过
    if (result.success && (req.user.permission === 0 || req.user.permission === 1 || req.user.permission === 2)) {
        try {
            const audioId = result.data.audioId;
            if (audioId) {
                global.db.prepare('UPDATE audio SET is_review = 1 WHERE id = ?').run(audioId);
                // 同时更新返回结果中的审核状态（可选）
                result.data.is_review = 1;
            }
        } catch (err) {
            console.error('自动审核音声失败:', err);
        }
    }
    
    if (result.success) result.code = 201;
    return result;
}));

// 下载音声 (需要登录)
router.get('/audios/download/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { classification_id } = req.query;

        let userId;
        try {
            const config = read_json('configs', 'config');
            const jwtSecret = config.token;
            const decoded = jwt.verify(token, jwtSecret);
            userId = decoded.id;
        } catch (error) {
            logger.warn('Token验证失败:', error.message);
            return res.status(401).json({ success: false, message: 'Token无效或已过期', code: 401 });
        }

        let classificationId = null;
        let classificationName = '全部音声';

        logger.debug(`收到下载请求，用户ID: ${userId}, 分类ID: ${classification_id}`);

        if (classification_id) {
            classificationId = parseInt(classification_id);
            if (!classificationId || classificationId <= 0) {
                logger.warn('无效的分类ID:', classification_id);
                return res.status(400).json({ success: false, message: '无效的分类ID', code: 400 });
            }

            const classification = queryOne(`
                SELECT name FROM audio_classification
                WHERE id = ? AND is_deleted = 0 AND is_review = 1
            `, [classificationId]);

            if (!classification) {
                logger.warn('音声分类不存在或未审核通过:', classificationId);
                return res.status(404).json({ success: false, message: '音声分类不存在或未审核通过', code: 404 });
            }

            classificationName = classification.name;
            logger.debug(`分类名称: ${classificationName}`);
        }

        logger.debug('获取音声数据...');
        const audios = await getAudiosForDownload(classificationId);
        logger.debug(`获取到 ${audios.length} 个音声`);

        if (audios.length === 0) {
            logger.warn('没有可下载的音声');
            return res.status(404).json({ success: false, message: '没有可下载的音声', code: 404 });
        }

        logger.debug('开始打包音声文件...');
        const packResult = await packAudios(audios, classificationName);

        if (!packResult.success) {
            logger.error('打包音声文件失败');
            return res.status(500).json({ success: false, message: '打包音声文件失败', code: 500 });
        }

        const today = new Date().toISOString().split('T')[0];
        const downloadLimitKey = `download:limit:${userId}:${today}`;

        try {
            if (global.redis) {
                const todayDownloaded = await global.redis.get(downloadLimitKey) || 0;
                const totalDownloadSize = parseInt(todayDownloaded) + packResult.fileSize;
                const appConfig = read_json("configs", "config");
                const dailyLimit = (appConfig.download?.audio || 200) * 1024 * 1024;

                if (totalDownloadSize > dailyLimit) {
                    logger.warn(`用户 ${userId} 超过每日下载限制，当前: ${(totalDownloadSize / 1024 / 1024).toFixed(2)}MB，限制: ${dailyLimit / 1024 / 1024}MB`);
                    return res.status(429).json({
                        success: false,
                        message: `每日下载量不能超过${dailyLimit / 1024 / 1024}MB，当前已下载 ${(parseInt(todayDownloaded) / 1024 / 1024).toFixed(2)}MB`
                    });
                }

                await global.redis.set(downloadLimitKey, totalDownloadSize, 'EX', 86400);
                logger.debug(`更新用户 ${userId} 今日下载量: ${(totalDownloadSize / 1024 / 1024).toFixed(2)}MB`);
            }
        } catch (redisError) {
            logger.error('检查下载限制时Redis错误:', redisError);
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(packResult.zipFileName)}"`);
        res.setHeader('Content-Length', packResult.fileSize);

        logger.info(`发送下载文件: ${packResult.zipFileName}，大小: ${(packResult.fileSize / 1024 / 1024).toFixed(2)}MB`);

        const fileStream = fs.createReadStream(packResult.zipFilePath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            logger.error('发送文件失败:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: '发送文件失败', code: 500 });
            }
        });

    } catch (error) {
        logger.error('下载音声失败:', error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: '下载音声失败', code: 500 });
        }
    }
});

/**
 * 记录音频播放量
 */
router.post('/audios/:id/play', optionalAuth, createRouteHandler(async (req) => {
    const audioId = parseInt(req.params.id);
    if (!audioId || audioId <= 0) {
        return { success: false, message: '无效的音频ID', code: 400 };
    }
    return await recordPlayCount(audioId, req, req.user || null);
}));

/**
 * 获取7天内热门音频
 */
router.get('/audios/popular/weekly', createRouteHandler(async (req) => {
    const limit = parseInt(req.query.limit) || 10;
    const finalLimit = Math.min(limit, 50);
    return await getWeeklyPopularAudios(finalLimit);
}));

/**
 * 获取总播放量排行
 */
router.get('/audios/popular/total', createRouteHandler(async (req) => {
    const limit = parseInt(req.query.limit) || 10;
    const finalLimit = Math.min(limit, 50);
    return await getTotalPopularAudios(finalLimit);
}));

export default router;