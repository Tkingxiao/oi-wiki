import { syncUserAvatar } from './avatarService.js';

// ==================== 配置参数 ====================
const BATCH_SIZE = 5;                       // 每批处理5个用户
const BATCH_INTERVAL_MS = 30 * 1000;        // 批次之间间隔30秒
const REQUEST_INTERVAL_MS = 2000;           // 单个请求间隔2秒（在批次内）
const RATE_LIMIT_WAIT_MS = 15 * 1000;       // 触发频率限制后等待15秒
const MAX_RETRIES = 1;                      // 最大重试次数

// 非高峰时段定义（凌晨2点 ~ 早上6点）
const OFF_PEAK_START_HOUR = 2;
const OFF_PEAK_END_HOUR = 6;

// 定时任务间隔：每15天执行一次（毫秒）
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

// ==================== 全局状态 ====================
let isSyncRunning = false;          // 是否正在同步
let syncAbortController = null;     // 用于中止同步

// ==================== 辅助函数 ====================

/**
 * 判断当前是否处于非高峰时段
 */
function isOffPeakTime() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= OFF_PEAK_START_HOUR && hour < OFF_PEAK_END_HOUR;
}

/**
 * 获取到下一个非高峰时段的等待时间（毫秒）
 */
function getWaitUntilOffPeak() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentSec = now.getSeconds();
    const currentMs = now.getMilliseconds();
    
    // 计算下一个凌晨2点的时间
    const nextOffPeak = new Date(now);
    if (currentHour >= OFF_PEAK_END_HOUR) {
        // 如果当前在6点之后，下一个非高峰是明天凌晨2点
        nextOffPeak.setDate(nextOffPeak.getDate() + 1);
    }
    nextOffPeak.setHours(OFF_PEAK_START_HOUR, 0, 0, 0);
    
    return nextOffPeak.getTime() - now.getTime();
}

/**
 * 暂停执行（可中止）
 */
async function pause(ms, signal) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('同步任务被中止'));
            });
        }
    });
}

/**
 * 同步单个用户头像，包含重试机制
 */
async function syncOneUser(user, signal) {
    let retry = 0;
    
    while (retry <= MAX_RETRIES) {
        // 检查是否被中止
        if (signal?.aborted) {
            throw new Error('同步任务被中止');
        }
        
        try {
            const result = await syncUserAvatar(user.id, user.bilibili_uid, true);
            if (result.success) {
                logger.info(`[头像同步] 用户 ${user.id} (${user.bilibili_uid}) 同步成功`);
                return { success: true };
            } else {
                // 检查是否为频率限制错误
                const isRateLimit = result.message && (
                    result.message.includes('频繁') || 
                    result.message.includes('-799')
                );
                if (isRateLimit && retry < MAX_RETRIES) {
                    logger.warn(`[头像同步] 用户 ${user.id} 触发频率限制，等待 ${RATE_LIMIT_WAIT_MS/1000} 秒后重试...`);
                    await pause(RATE_LIMIT_WAIT_MS, signal);
                    retry++;
                } else {
                    logger.error(`[头像同步] 用户 ${user.id} 同步失败: ${result.message}`);
                    return { success: false, error: result.message };
                }
            }
        } catch (err) {
            const isRateLimit = err.message && (
                err.message.includes('-799') || 
                err.message.includes('频繁') ||
                err.message.includes('rate')
            );
            if (isRateLimit && retry < MAX_RETRIES) {
                logger.warn(`[头像同步] 用户 ${user.id} 触发频率限制 (${err.message})，等待 ${RATE_LIMIT_WAIT_MS/1000} 秒后重试...`);
                await pause(RATE_LIMIT_WAIT_MS, signal);
                retry++;
            } else {
                logger.error(`[头像同步] 用户 ${user.id} 同步失败: ${err.message}`);
                return { success: false, error: err.message };
            }
        }
    }
    return { success: false, error: '重试次数已用完' };
}

/**
 * 分批同步所有用户
 */
async function syncAllUserAvatarsBatch(signal) {
    logger.info('[头像同步] 开始获取用户列表...');
    
    const users = global.db.prepare(`
        SELECT id, bilibili_uid 
        FROM user 
        WHERE bilibili_uid IS NOT NULL AND bilibili_uid != ''
    `).all();
    
    if (users.length === 0) {
        logger.info('[头像同步] 没有需要同步的用户');
        return;
    }
    
    logger.info(`[头像同步] 共 ${users.length} 个用户待同步，将分 ${Math.ceil(users.length / BATCH_SIZE)} 批执行`);
    
    let successCount = 0;
    let failCount = 0;
    let batchNumber = 1;
    
    // 分批处理
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        // 检查是否被中止
        if (signal?.aborted) {
            logger.info('[头像同步] 任务被中止');
            break;
        }
        
        const batch = users.slice(i, i + BATCH_SIZE);
        logger.info(`[头像同步] 开始第 ${batchNumber} 批 (${batch.length} 个用户)`);
        
        // 处理当前批次
        for (const user of batch) {
            if (signal?.aborted) break;
            
            const result = await syncOneUser(user, signal);
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // 批次内请求间隔
            if (!signal?.aborted) {
                await pause(REQUEST_INTERVAL_MS, signal);
            }
        }
        
        logger.info(`[头像同步] 第 ${batchNumber} 批完成，当前累计成功 ${successCount} 个，失败 ${failCount} 个`);
        
        // 批次之间间隔（最后一批后不等待）
        if (i + BATCH_SIZE < users.length && !signal?.aborted) {
            logger.info(`[头像同步] 等待 ${BATCH_INTERVAL_MS/1000} 秒后开始下一批...`);
            await pause(BATCH_INTERVAL_MS, signal);
        }
        
        batchNumber++;
    }
    
    logger.info(`[头像同步] 全部同步完成，总计成功 ${successCount} 个，失败 ${failCount} 个`);
}

/**
 * 同步所有用户头像（主入口，包含非高峰时段调度）
 */
async function syncAllUserAvatars() {
    // 防止重复运行
    if (isSyncRunning) {
        logger.warn('[头像同步] 上一次同步尚未结束，跳过本次执行');
        return;
    }
    
    isSyncRunning = true;
    syncAbortController = new AbortController();
    const signal = syncAbortController.signal;
    
    try {
        // 检查是否在非高峰时段
        if (!isOffPeakTime()) {
            const waitMs = getWaitUntilOffPeak();
            const waitMinutes = Math.round(waitMs / 60000);
            logger.info(`[头像同步] 当前不在非高峰时段(02:00-06:00)，将等待 ${waitMinutes} 分钟后自动开始`);
            
            // 等待至非高峰时段（如果在此期间服务重启，任务会丢失，但无伤大雅）
            await pause(waitMs, signal);
            logger.info('[头像同步] 已进入非高峰时段，开始同步...');
        } else {
            logger.info('[头像同步] 当前处于非高峰时段，立即开始同步...');
        }
        
        await syncAllUserAvatarsBatch(signal);
        
    } catch (error) {
        if (error.message === '同步任务被中止') {
            logger.info('[头像同步] 任务已被手动中止');
        } else {
            logger.error('[头像同步] 同步过程发生异常:', error);
        }
    } finally {
        isSyncRunning = false;
        syncAbortController = null;
    }
}

/**
 * 启动头像自动同步定时任务
 */
export function startAvatarSyncJob() {
    // 服务启动后延迟5分钟首次执行（避免与启动高峰重叠）
    setTimeout(() => {
        syncAllUserAvatars();
    }, 5 * 60 * 1000);
    
    // 设置定时任务（每15天）
    setInterval(() => {
        syncAllUserAvatars();
    }, FIFTEEN_DAYS_MS);
    
    logger.info('[头像同步] 定时任务已启动：每15天执行一次，仅在凌晨2点-6点运行，每批5个用户，批次间隔30秒，请求间隔2秒');
}

/**
 * 手动停止当前同步任务（供运维使用，可选）
 */
export function stopAvatarSyncJob() {
    if (syncAbortController) {
        syncAbortController.abort();
        logger.info('[头像同步] 已发送中止信号');
    }
}