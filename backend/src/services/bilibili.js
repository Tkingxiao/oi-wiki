import axios from 'axios';
import crypto from 'crypto';
import { read_json } from '../method/read.js';

/**
 * 生成缓存key的函数
 * @param {string} path - 请求路径
 * @param {object} params - 查询参数
 * @returns {string} 缓存key
 */
function generateCacheKey(path, params = {}) {
    const sortedParams = {};
    Object.keys(params).sort().forEach(key => {
        sortedParams[key] = params[key];
    });
    const keyData = { path: path, params: sortedParams };
    const jsonString = JSON.stringify(keyData);
    const hash = crypto.createHash('md5').update(jsonString).digest('hex');
    return `bilibili_api:${hash}`;
}

async function getCachedData(cacheKey) {
    try {
        const cachedData = await global.redis.get(cacheKey);
        if (cachedData) {
            logger.debug(`缓存命中: ${cacheKey}`);
            return JSON.parse(cachedData);
        }
    } catch (error) {
        logger.warn('获取缓存失败:', error);
    }
    return null;
}

async function setCachedData(cacheKey, data, ttl) {
    try {
        const cacheValue = JSON.stringify(data);
        await global.redis.setex(cacheKey, ttl, cacheValue);
        logger.debug(`已缓存到Redis (${ttl}秒): ${cacheKey}`);
    } catch (error) {
        logger.warn('设置缓存失败:', error);
    }
}

async function callBilibiliAPI(path, params = {}, cookie = null) {
    const baseURL = 'https://api.live.bilibili.com';
    const targetURL = baseURL + path;
    logger.info(`请求Bilibili API: ${targetURL}`, params);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://live.bilibili.com'
    };
    if (cookie) {
        headers['Cookie'] = cookie;
    }

    const response = await axios({
        method: 'GET',
        url: targetURL,
        params: params,
        timeout: 10000,
        validateStatus: () => true,
        headers: headers
    });

    if (response.status !== 200) {
        throw new Error(`Bilibili API 请求失败: ${response.status} ${response.statusText}`);
    }
    return response.data;
}

/**
 * 获取房间信息
 */
export async function getRoomInfo() {
    const config = read_json('configs', 'config');
    const path = '/room/v1/Room/get_info';
    const params = { room_id: config.bilibili.roomId };
    const cacheKey = generateCacheKey(path, params);
    let data = await getCachedData(cacheKey);
    if (!data) {
        data = await callBilibiliAPI(path, params);
        await setCachedData(cacheKey, data, config.bilibili.ttl || 300);
    }
    return data;
}

/**
 * 获取主播信息
 */
export async function getMasterInfo() {
    const config = read_json('configs', 'config');
    const path = '/live_user/v1/Master/info';
    const params = { uid: config.bilibili.userId };
    const cacheKey = generateCacheKey(path, params);
    let data = await getCachedData(cacheKey);
    if (!data) {
        data = await callBilibiliAPI(path, params);
        await setCachedData(cacheKey, data, config.bilibili.ttl || 300);
    }
    return data;
}

/**
 * 获取完整大航海列表（分页拉取全部）
 * @returns {Promise<object>} 包含所有成员的完整数据
 */
export async function getFullGuardList() {
    const config = read_json('configs', 'config');
    const roomId = config.bilibili.roomId;
    const userId = config.bilibili.userId;
    const cookie = config.bilibili.cookie || null;
    const pageSize = 10;
    let allMembers = [];
    let totalCount = 0;

    // 第一页请求，获取总数
    let firstRes = null;
    try {
        firstRes = await callBilibiliAPI('/guard/topList', {
            ruid: userId,
            roomid: roomId,
            page: 1,
            page_size: pageSize
        }, cookie);
        if (firstRes.code !== 0) {
            throw new Error(`API返回错误码: ${firstRes.code}`);
        }
        totalCount = firstRes.data?.info?.num || 0;
        const list = firstRes.data?.data?.list || firstRes.data?.data?.top_list || [];
        allMembers.push(...list);
        logger.info(`总大航海人数: ${totalCount}, 第1页获取 ${list.length} 人`);
    } catch (err) {
        logger.error('获取大航海第一页失败:', err);
        return { code: -1, message: err.message, data: [] };
    }

    if (totalCount === 0) {
        return { code: 0, data: allMembers, total: 0 };
    }

    const totalPages = Math.ceil(totalCount / pageSize);
    for (let page = 2; page <= totalPages; page++) {
        let retry = 0;
        let success = false;
        let res = null;
        while (!success && retry < 3) {
            try {
                res = await callBilibiliAPI('/guard/topList', {
                    ruid: userId,
                    roomid: roomId,
                    page: page,
                    page_size: pageSize
                }, cookie);
                if (res.code === 0) {
                    success = true;
                } else {
                    logger.warn(`第 ${page} 页返回非0码: ${res.code}，重试 ${retry+1}/3`);
                    retry++;
                    await new Promise(r => setTimeout(r, 1000 * retry));
                }
            } catch (err) {
                logger.error(`第 ${page} 页请求失败: ${err.message}，重试 ${retry+1}/3`);
                retry++;
                await new Promise(r => setTimeout(r, 1000 * retry));
            }
        }
        if (!success) {
            logger.error(`第 ${page} 页请求最终失败，停止拉取`);
            break;
        }
        const list = res.data?.data?.list || res.data?.data?.top_list || [];
        allMembers.push(...list);
        logger.debug(`第 ${page} 页获取 ${list.length} 人，累计 ${allMembers.length} 人`);
        await new Promise(r => setTimeout(r, 200));
    }

    logger.info(`完整大航海列表获取完成，共 ${allMembers.length} 人`);
    return { code: 0, data: allMembers, total: totalCount };
}

/**
 * 获取排行榜数据（单页，兼容旧调用）
 */
export async function getTopListNew() {
    const config = read_json('configs', 'config');
    const path = '/guard/topList';
    const params = {
        ruid: config.bilibili.userId,
        roomid: config.bilibili.roomId,
        page: 1,
        page_size: 30
    };
    const cacheKey = generateCacheKey(path, params);
    let data = await getCachedData(cacheKey);
    if (!data) {
        const cookie = config.bilibili.cookie || null;
        data = await callBilibiliAPI(path, params, cookie);
        await setCachedData(cacheKey, data, config.bilibili.ttl || 300);
    }
    return data;
}