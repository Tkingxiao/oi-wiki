// backend/src/services/bilibiliVideo.js
import axios from 'axios';
import { queryAll, queryOne, insert, remove } from '../method/database.js';
import { createSuccessResponse, createErrorResponse } from '../method/business-utils.js';

// 更完整的浏览器伪装头
function getBilibiliHeaders() {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.bilibili.com/',
        'Origin': 'https://www.bilibili.com',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
}

/**
 * 搜索B站视频（保留用于智能推荐，但热门视频已改用 popular 接口）
 */
export async function searchBilibiliVideos(keyword, limit = 10, retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
                params: {
                    search_type: 'video',
                    keyword: keyword,
                    order: 'click',
                    page: 1,
                    page_size: limit
                },
                headers: getBilibiliHeaders(),
                timeout: 15000
            });

            if (response.data.code !== 0) {
                throw new Error(response.data.message || `B站API返回错误码: ${response.data.code}`);
            }

            const videos = response.data.data.result || [];
            return videos.map(v => ({
                bvid: v.bvid,
                title: v.title.replace(/<[^>]+>/g, ''),
                play: v.play,
                pic: v.pic,
                owner: {
                    name: v.author,
                    mid: v.mid
                }
            }));
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
    logger.error('搜索B站视频失败:', lastError.message);
    throw lastError;
}

/**
 * 从B站热门视频中获取播放量前四（用于左侧热门小剧场）
 */
async function fetchTop4VideosFromBilibili() {
    try {
        const response = await axios.get('https://api.bilibili.com/x/web-interface/popular', {
            params: { pn: 1, ps: 20 },
            headers: getBilibiliHeaders(),
            timeout: 15000
        });

        if (response.data.code !== 0) {
            throw new Error(response.data.message || '热门接口返回错误');
        }

        const videos = response.data.data.list || [];
        const sorted = videos.sort((a, b) => (b.stat?.view || 0) - (a.stat?.view || 0));
        return sorted.slice(0, 4).map(v => ({
            bvid: v.bvid,
            title: v.title,
            play: v.stat?.view || 0,
            pic: v.pic,
            owner: {
                name: v.owner?.name,
                mid: v.owner?.mid
            }
        }));
    } catch (error) {
        logger.error('获取B站热门视频失败:', error.message);
        return [];
    }
}

/**
 * 获取热门视频（播放量前四，带手动刷新冷却状态）
 */
export async function getHotVideos() {
    try {
        const videos = await fetchTop4VideosFromBilibili();
        const now = Math.floor(Date.now() / 1000);

        const lastManual = queryOne(`
            SELECT refresh_time FROM hot_video_refresh_log 
            WHERE refresh_type = 'manual' 
            ORDER BY refresh_time DESC LIMIT 1
        `);

        let canManualRefresh = true;
        let nextManualRefresh = null;
        if (lastManual) {
            const elapsed = now - lastManual.refresh_time;
            const cooldown = 15 * 24 * 3600;
            if (elapsed < cooldown) {
                canManualRefresh = false;
                nextManualRefresh = lastManual.refresh_time + cooldown;
            }
        }

        return createSuccessResponse('获取成功', {
            videos: videos.slice(0, 4),
            last_update: now,
            can_manual_refresh: canManualRefresh,
            next_manual_refresh: nextManualRefresh
        });
    } catch (err) {
        logger.error('获取热门视频失败:', err);
        return createErrorResponse('获取失败', 500);
    }
}

/**
 * 管理员手动刷新热门视频（记录日志，受15天冷却）
 */
export async function manualRefreshHotVideos(userId) {
    try {
        const now = Math.floor(Date.now() / 1000);
        logger.info(`[手动刷新] 管理员 ${userId} 尝试刷新`);

        const lastManual = queryOne(`
            SELECT refresh_time FROM hot_video_refresh_log 
            WHERE refresh_type = 'manual' 
            ORDER BY refresh_time DESC LIMIT 1
        `);

        if (lastManual) {
            const elapsed = now - lastManual.refresh_time;
            const cooldown = 15 * 24 * 3600;
            if (elapsed < cooldown) {
                const remainDays = Math.ceil((cooldown - elapsed) / 86400);
                logger.warn(`[手动刷新] 冷却中，剩余 ${remainDays} 天`);
                return createErrorResponse(`手动刷新冷却中，剩余 ${remainDays} 天`, 400);
            }
        }

        const result = insert(
            'INSERT INTO hot_video_refresh_log (user_id, refresh_type, refresh_time) VALUES (?, ?, ?)',
            [userId, 'manual', now]
        );

        if (!result || result.changes === 0) {
            logger.error('[手动刷新] 插入记录失败');
            return createErrorResponse('刷新失败，请稍后重试', 500);
        }

        logger.info(`管理员 ${userId} 手动刷新了热门视频`);
        return createSuccessResponse('刷新成功，热门视频已更新');
    } catch (error) {
        logger.error('[手动刷新] 异常:', error);
        return createErrorResponse('刷新失败: ' + error.message, 500);
    }
}

/**
 * 用户提交 BV 审核
 * @param {number} userId - 用户ID
 * @param {string} userName - 用户名
 * @param {string} userAvatar - 用户头像
 * @param {string} bv - BV号
 * @param {number} userPermission - 用户权限等级（0:海葵王, 1:超级管理员, 2:管理员, 3:普通用户）
 */
export async function submitBvForAudit(userId, userName, userAvatar, bv, userPermission = 3) {
    if (!bv || !/^BV[a-zA-Z0-9]{10}$/.test(bv)) {
        return createErrorResponse('无效的BV号', 400);
    }

    // 检查是否已存在
    const existing = queryOne(`
        SELECT id FROM video_submissions WHERE bv = ? AND status IN (0, 1)
    `, [bv]);

    if (existing) {
        return createErrorResponse('该 BV 已提交过审核', 400);
    }

    // 检查是否已在审核通过列表
    const existingAudited = queryOne(`
        SELECT id FROM audited_bv WHERE bv = ?
    `, [bv]);

    if (existingAudited) {
        return createErrorResponse('该 BV 已在节目列表中', 400);
    }

    // 管理员及以上权限（permission <= 2）直接审核通过
    // 确保权限值是数字类型
    let perm = userPermission;
    if (typeof perm === 'string') {
        perm = parseInt(perm, 10);
    }
    if (typeof perm !== 'number' || isNaN(perm)) {
        perm = 3; // 默认普通用户
    }
    const isAdmin = perm <= 2;
    logger.info(`[submitBvForAudit] 用户 ${userName}(ID:${userId}) 投稿 BV: ${bv}, 原始权限: ${userPermission}(类型:${typeof userPermission}), 转换后: ${perm}, 是否管理员: ${isAdmin}`);

    if (isAdmin) {
        // 直接添加到审核通过表
        insert(`
            INSERT INTO audited_bv (bv, note, created_at)
            VALUES (?, ?, strftime('%s','now'))
        `, [bv, `管理员 ${userName} 投稿`]);

        // 同时记录到投稿表，状态为已通过
        insert(`
            INSERT INTO video_submissions (user_id, user_name, user_avatar, bv, status, created_at)
            VALUES (?, ?, ?, ?, 1, strftime('%s','now'))
        `, [userId, userName, userAvatar, bv]);

        logger.info(`管理员 ${userName} 投稿 BV 直接通过: ${bv}`);
        return createSuccessResponse('投稿成功，已自动审核通过');
    } else {
        // 普通用户需要等待审核
        insert(`
            INSERT INTO video_submissions (user_id, user_name, user_avatar, bv, status, created_at)
            VALUES (?, ?, ?, ?, 0, strftime('%s','now'))
        `, [userId, userName, userAvatar, bv]);

        logger.info(`用户 ${userName} 提交 BV 审核: ${bv}`);
        return createSuccessResponse('提交成功，等待管理员审核');
    }
}

/**
 * 获取所有审核通过的BV列表（最多10条）
 */
export async function getAuditedBvList() {
    try {
        const list = queryAll(`
            SELECT id, bv, note, created_at, updated_at
            FROM audited_bv
            ORDER BY created_at DESC
            LIMIT 10
        `);
        return createSuccessResponse('获取成功', list);
    } catch (error) {
        logger.error('获取审核BV列表失败:', error);
        return createErrorResponse('获取失败', 500);
    }
}

/**
 * 添加审核BV（管理员调用）
 */
export async function addAuditedBv(bv, note = '') {
    if (!bv || !/^BV[a-zA-Z0-9]{10}$/.test(bv)) {
        return createErrorResponse('无效的BV号', 400);
    }
    try {
        const existing = queryOne('SELECT id FROM audited_bv WHERE bv = ?', [bv]);
        if (existing) {
            return createErrorResponse('该BV已存在', 400);
        }
        insert('INSERT INTO audited_bv (bv, note) VALUES (?, ?)', [bv, note]);
        logger.info(`添加审核BV: ${bv}`);
        return createSuccessResponse('添加成功');
    } catch (error) {
        logger.error('添加审核BV失败:', error);
        return createErrorResponse('添加失败', 500);
    }
}

/**
 * 删除审核BV（管理员调用）
 */
export async function deleteAuditedBv(id) {
    try {
        // 先获取要删除的BV号
        const record = queryOne('SELECT bv FROM audited_bv WHERE id = ?', [id]);
        if (!record) {
            return createErrorResponse('记录不存在', 404);
        }
        
        const bv = record.bv;
        
        // 删除 audited_bv 表中的记录
        const result = remove('DELETE FROM audited_bv WHERE id = ?', [id]);
        if (result.changes === 0) {
            return createErrorResponse('记录不存在', 404);
        }
        
        // 同时删除 video_submissions 表中对应的审核记录
        const submissionResult = remove('DELETE FROM video_submissions WHERE bv = ?', [bv]);
        logger.info(`删除审核BV ID: ${id}, BV: ${bv}, 同步删除投稿记录: ${submissionResult.changes}条`);
        
        return createSuccessResponse('删除成功');
    } catch (error) {
        logger.error('删除审核BV失败:', error);
        return createErrorResponse('删除失败', 500);
    }
}

/**
 * 获取B站视频详情（带完整信息）
 */
export async function getBilibiliVideoDetail(bv) {
    if (!bv || !/^BV[a-zA-Z0-9]{10}$/.test(bv)) {
        return createErrorResponse('无效的BV号', 400);
    }
    
    try {
        const response = await axios.get('https://api.bilibili.com/x/web-interface/view', {
            params: { bvid: bv },
            headers: getBilibiliHeaders(),
            timeout: 15000
        });

        if (response.data.code !== 0) {
            return createErrorResponse(response.data.message || '获取视频详情失败', 400);
        }

        const data = response.data.data;
        return createSuccessResponse('获取成功', {
            bvid: data.bvid,
            title: data.title,
            pic: data.pic,
            play: data.stat?.view || 0,
            owner: {
                name: data.owner?.name,
                mid: data.owner?.mid
            }
        });
    } catch (error) {
        logger.error('获取B站视频详情失败:', error.message);
        return createErrorResponse('获取视频详情失败: ' + error.message, 500);
    }
}