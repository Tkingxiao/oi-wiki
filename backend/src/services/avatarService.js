import { queryOne, queryAll, update } from '../method/database.js';
import { getCurrentTimestamp, createSuccessResponse, createErrorResponse } from '../method/business-utils.js';
import path from 'path';
import fs from 'fs';
import https from 'https';
import axios from 'axios';
import { uploadToCOS, isCOSAvailable } from './cos.js';

const AVATAR_DIR = '/var/www/oiwiki/backend/data/document/images/avatar';
const COS_BASE = 'https://oiwiki-1418547858.cos.ap-shanghai.myqcloud.com/';

function ensureAvatarDir() {
    if (!fs.existsSync(AVATAR_DIR)) {
        fs.mkdirSync(AVATAR_DIR, { recursive: true });
        logger.info(`创建头像目录: ${AVATAR_DIR}`);
    }
}

export async function fetchBilibiliAvatarUrl(bilibiliUid) {
    if (!bilibiliUid) return null;

    try {
        const url = `https://api.bilibili.com/x/web-interface/card?mid=${bilibiliUid}`;

        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://space.bilibili.com'
                },
                timeout: 10000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.code === 0 && json.data?.card?.face) {
                            resolve(json.data.card.face);
                        } else {
                            logger.warn(`B站API返回无效数据: uid=${bilibiliUid}, code=${json.code}`);
                            resolve(null);
                        }
                    } catch (e) {
                        logger.error(`解析B站API响应失败: ${e.message}`);
                        resolve(null);
                    }
                });
            });

            req.on('error', (err) => {
                logger.error(`请求B站API失败: ${err.message}`);
                resolve(null);
            });

            req.on('timeout', () => {
                req.destroy();
                logger.error(`请求B站API超时: uid=${bilibiliUid}`);
                resolve(null);
            });
        });
    } catch (error) {
        logger.error(`获取B站头像URL失败: ${error.message}`);
        return null;
    }
}

export async function downloadAvatar(imageUrl, uid) {
    if (!imageUrl || !uid) return null;

    ensureAvatarDir();

    // B 站头像统一保存为 jpg
    const filename = `${uid}.jpg`;
    const filepath = path.join(AVATAR_DIR, filename);

    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://space.bilibili.com'
            },
            timeout: 15000,
            maxRedirects: 5
        });

        if (!res.data || res.data.length < 100) {
            logger.error(`下载头像失败: 响应数据太小, url=${imageUrl}`);
            return null;
        }

        let avatarUrl;
        if (isCOSAvailable()) {
            const cosKey = `avatar/${filename}`;
            avatarUrl = await uploadToCOS(Buffer.from(res.data), cosKey, 'image/jpeg');
            logger.info(`头像已上传到 COS: ${cosKey}`);
        } else {
            fs.writeFileSync(filepath, Buffer.from(res.data));
            const stats = fs.statSync(filepath);
            logger.info(`头像下载成功: ${filename}, size=${stats.size}`);
            avatarUrl = `/api/images/avatar/${filename}`;
        }

        return avatarUrl;
    } catch (error) {
        logger.error(`下载头像异常: ${error.message}, url=${imageUrl}`);
        return null;
    }
}

export async function syncUserAvatar(userId, bilibiliUid, force = false) {
    if (!userId || !bilibiliUid) {
        return createErrorResponse('用户ID和B站UID不能为空', 400);
    }

    try {
        if (!force) {
            const user = queryOne(
                'SELECT avatar_last_updated FROM user WHERE id = ?',
                [userId]
            );

            if (user?.avatar_last_updated) {
                const lastUpdate = user.avatar_last_updated;
                const now = getCurrentTimestamp();
                const threeDays = 3 * 24 * 60 * 60;

                if (now - lastUpdate < threeDays) {
                    const daysLeft = Math.ceil((threeDays - (now - lastUpdate)) / (24 * 60 * 60));
                    return createSuccessResponse(`头像已是最新，${daysLeft}天后可再次更新`, {
                        updated: false,
                        daysLeft
                    });
                }
            }
        }

        const avatarUrl = await fetchBilibiliAvatarUrl(bilibiliUid);
        if (!avatarUrl) {
            return createErrorResponse('无法从B站获取头像', 400);
        }

        const localPath = await downloadAvatar(avatarUrl, bilibiliUid);
        if (!localPath) {
            logger.warn(`头像下载失败，仅保存URL: userId=${userId}`);
        }

        const now = getCurrentTimestamp();
        const avatarToSave = localPath || `/api/images/avatar/${bilibiliUid}.jpg`;
        update(
            'UPDATE user SET avatar = ?, avatar_last_updated = ?, update_time = ? WHERE id = ?',
            [avatarToSave, now, now, userId]
        );

        logger.info(`用户头像同步成功: userId=${userId}, bilibiliUid=${bilibiliUid}`);
        return createSuccessResponse('头像同步成功', {
            updated: true,
            avatar: localPath || avatarUrl,
            isLocal: !!localPath
        });
    } catch (error) {
        logger.error(`同步用户头像失败: ${error.message}`);
        return createErrorResponse('同步头像失败', 500);
    }
}

export function getUserAvatar(userId) {
    if (!userId) return null;

    const user = queryOne('SELECT avatar, bilibili_uid FROM user WHERE id = ?', [userId]);
    if (!user) return null;

    if (user.avatar && user.avatar.startsWith('/api/images/avatar/')) {
        return user.avatar;
    }
    if (user.avatar && user.avatar.startsWith('/images/avatar/')) {
        return `/api${user.avatar}`;
    }

    if (user.bilibili_uid) {
        const localPath = path.join(AVATAR_DIR, `${user.bilibili_uid}.jpg`);
        if (fs.existsSync(localPath)) {
            return `/api/images/avatar/${user.bilibili_uid}.jpg`;
        }
    }

    return user.avatar;
}

export async function autoUpdateAvatars() {
    try {
        const now = getCurrentTimestamp();
        const threeDays = 3 * 24 * 60 * 60;
        const threshold = now - threeDays;

        const users = queryAll(
            `SELECT id, bilibili_uid, avatar_last_updated FROM user
             WHERE bilibili_uid IS NOT NULL
             AND (avatar_last_updated IS NULL OR avatar_last_updated < ?)`,
            [threshold]
        );

        logger.info(`发现 ${users.length} 个用户需要更新头像`);

        let successCount = 0;
        let failCount = 0;

        for (const user of users) {
            try {
                const result = await syncUserAvatar(user.id, user.bilibili_uid, true);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                logger.error(`自动更新头像失败: userId=${user.id}, error=${err.message}`);
                failCount++;
            }
        }

        logger.info(`头像自动更新完成: 成功=${successCount}, 失败=${failCount}`);
        return createSuccessResponse('自动更新完成', {
            total: users.length,
            success: successCount,
            failed: failCount
        });
    } catch (error) {
        logger.error(`自动更新头像任务失败: ${error.message}`);
        return createErrorResponse('自动更新失败', 500);
    }
}

export async function manualRefreshAvatar(userId) {
    if (!userId) {
        return createErrorResponse('用户ID不能为空', 400);
    }

    const user = queryOne('SELECT bilibili_uid FROM user WHERE id = ?', [userId]);
    if (!user) {
        return createErrorResponse('用户不存在', 404);
    }

    if (!user.bilibili_uid) {
        return createErrorResponse('未绑定B站UID', 400);
    }

    return await syncUserAvatar(userId, user.bilibili_uid, true);
}

export async function autoSyncOnLogin(userId, bilibiliUid) {
    if (!userId || !bilibiliUid) return null;

    try {
        const result = await syncUserAvatar(userId, bilibiliUid, true);
        logger.info(`登录自动同步头像: userId=${userId}, result=${result.success}`);
        return result;
    } catch (error) {
        logger.error(`登录自动同步头像失败: ${error.message}`);
        return { error: error.message };
    }
}
