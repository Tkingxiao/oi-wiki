import axios from 'axios';
import Database from 'better-sqlite3';
import schedule from 'node-schedule';
import fs from 'fs';

const ROOM_ID = 1809236885;
const ANCHOR_UID = 3546585537448033;

// 新 API 地址（优先使用）
const NEW_API_URL = 'https://api.live.bilibili.com/xlive/general-interface/v1/rank/getFansMembersRank';

// 旧 API 地址（备选）
const OLD_LIST_API = 'https://api.live.bilibili.com/xlive/app-room/v2/guardTab/topList';
const OLD_TOP_API = 'https://api.live.bilibili.com/guard/topList';

// 通用请求头
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://live.bilibili.com/',
    'Origin': 'https://live.bilibili.com'
};

let db = null;

function initDatabase() {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database('./data/maruko-sql.db');

    db.prepare(`
        CREATE TABLE IF NOT EXISTS guard_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            guard_level INTEGER,
            medal_level INTEGER DEFAULT 0,
            username TEXT,
            update_time INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_cache_uid ON guard_cache(uid)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_guard_cache_level ON guard_cache(guard_level)').run();
    
    db.prepare(`
        CREATE TABLE IF NOT EXISTS guard_cache_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            total_count INTEGER DEFAULT 0,
            api_total_count INTEGER DEFAULT 0,
            update_time INTEGER
        )
    `).run();
    
    try {
        db.prepare('ALTER TABLE guard_cache ADD COLUMN medal_level INTEGER DEFAULT 0').run();
    } catch (e) {
        if (!e.message.includes('duplicate column name')) console.warn(e.message);
    }
}

// ========== 新 API 获取数据（分页，每页最多50条）==========
async function fetchFansRank(page = 1, pageSize = 50, cookie = '') {
    const params = new URLSearchParams({
        ruid: ANCHOR_UID,
        roomid: ROOM_ID,
        page: page,
        page_size: pageSize
    });
    const url = `${NEW_API_URL}?${params.toString()}`;
    const headers = { ...HEADERS };
    if (cookie) headers.Cookie = cookie;

    const response = await axios.get(url, { headers, timeout: 15000 });
    if (response.data.code !== 0) {
        throw new Error(`新API错误: ${response.data.message || response.data.msg}`);
    }
    return response.data.data;
}

async function fetchAllGuardsNew(cookie) {
    let allMembers = [];
    let page = 1;
    const pageSize = 50;
    let hasMore = true;
    let totalCount = 0;
    const maxPages = 200;

    while (hasMore && page <= maxPages) {
        const data = await fetchFansRank(page, pageSize, cookie);
        
        if (!data) {
            hasMore = false;
            break;
        }
        
        totalCount = data.total || 0;
        
        let items = [];
        if (data.item && Array.isArray(data.item)) {
            items = data.item;
        } else if (data.list && Array.isArray(data.list)) {
            items = data.list;
        } else if (data.rank && Array.isArray(data.rank)) {
            items = data.rank;
        } else if (Array.isArray(data)) {
            items = data;
        }
        
        if (items.length === 0) {
            hasMore = false;
            break;
        }
        
        allMembers.push(...items);
        
        if (totalCount > 0 && allMembers.length >= totalCount) {
            hasMore = false;
            break;
        }
        
        page++;
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log(`✅ 新API获取完成: ${allMembers.length} 个粉丝牌用户 (API报告总数: ${totalCount})`);
    return { members: allMembers, totalCount };
}

// ========== 旧 API 组合（备选）==========
async function getRealRoomId(cookie) {
    const url = 'https://api.live.bilibili.com/room/v1/Room/get_info';
    const res = await axios.get(url, { params: { id: ROOM_ID }, headers: { ...HEADERS, Cookie: cookie } });
    if (res.data.code === 0) return res.data.data.room_id;
    throw new Error('获取真实房间号失败');
}

async function fetchAllGuardsOld(cookie) {
    const realRoomId = await getRealRoomId(cookie);
    let page = 1;
    const pageSize = 10;
    let allMembers = [];
    let hasMore = true;
    const maxPages = 50;

    // 分页获取 list 成员
    while (hasMore && page <= maxPages) {
        let success = false;
        let retry = 0;
        let res = null;
        while (!success && retry < 3) {
            try {
                const params = {
                    ruid: ANCHOR_UID,
                    roomid: realRoomId,
                    page: page,
                    page_size: pageSize
                };
                res = await axios.get(OLD_LIST_API, { params, headers: { ...HEADERS, Cookie: cookie }, timeout: 10000 });
                if (res.data.code === 0) {
                    success = true;
                } else {
                    console.warn(`第 ${page} 页返回非0码: ${res.data.code}，重试 ${retry+1}/3`);
                    retry++;
                    await new Promise(r => setTimeout(r, 1000 * retry));
                }
            } catch (err) {
                console.error(`第 ${page} 页请求失败: ${err.message}，重试 ${retry+1}/3`);
                retry++;
                await new Promise(r => setTimeout(r, 1000 * retry));
            }
        }
        if (!success) {
            console.error(`第 ${page} 页请求最终失败，停止拉取`);
            break;
        }

        const list = res.data.data.list || [];
        console.log(`第 ${page} 页获取到 ${list.length} 人，累计 ${allMembers.length + list.length} 人`);
        allMembers.push(...list);

        if (list.length === 0) {
            hasMore = false;
            break;
        }
        page++;
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    }

    // 补充 top3 成员（避免遗漏）
    try {
        const topParams = {
            ruid: ANCHOR_UID,
            roomid: realRoomId,
            page: 1,
            page_size: 10
        };
        const topRes = await axios.get(OLD_TOP_API, { params: topParams, headers: { ...HEADERS, Cookie: cookie }, timeout: 10000 });
        if (topRes.data.code === 0) {
            const top3 = topRes.data.data?.top3 || [];
            if (top3.length) {
                console.log(`获取到 top3 成员: ${top3.length} 人`);
                const existingUids = new Set(allMembers.map(m => String(m.uid)));
                for (const m of top3) {
                    const uidStr = String(m.uid);
                    if (!existingUids.has(uidStr)) {
                        allMembers.push(m);
                        existingUids.add(uidStr);
                    }
                }
            }
        }
    } catch (err) {
        console.warn('获取 top3 时出错:', err.message);
    }

    console.log(`旧API获取到 ${allMembers.length} 个粉丝牌子用户`);
    return allMembers;
}

// ========== 统一入口：优先新API，失败则回退旧API ==========
async function fetchAllGuards(cookie) {
    let result = { members: [], totalCount: 0 };
    try {
        console.log('尝试使用新API获取粉丝牌数据...');
        result = await fetchAllGuardsNew(cookie);
        if (result.members.length > 0) {
            console.log('新API获取成功');
            return result;
        } else {
            console.warn('新API返回空数据，尝试回退到旧API');
        }
    } catch (err) {
        console.error('新API失败:', err.message);
        console.log('回退到旧API...');
    }
    const oldMembers = await fetchAllGuardsOld(cookie);
    return { members: oldMembers, totalCount: oldMembers.length };
}

// ========== 提取 medal_level（兼容新旧数据结构）==========
function extractMedalLevel(member) {
    if (typeof member.level !== 'undefined') {
        return member.level;
    }
    if (member.medal_info && typeof member.medal_info.medal_level !== 'undefined') {
        return member.medal_info.medal_level;
    }
    if (typeof member.medal_level !== 'undefined') {
        return member.medal_level;
    }
    return 0;
}

function extractGuardLevel(member) {
    if (typeof member.guard_level !== 'undefined') {
        return member.guard_level;
    }
    if (member.medal_info && typeof member.medal_info.guard_level !== 'undefined') {
        return member.medal_info.guard_level;
    }
    return null;
}

function saveCache(members, updateTime, apiTotalCount = 0) {
    if (!db) initDatabase();
    db.prepare('DELETE FROM guard_cache').run();
    const insert = db.prepare('INSERT INTO guard_cache (uid, guard_level, medal_level, username, update_time) VALUES (?, ?, ?, ?, ?)');

    for (const m of members) {
        const uidStr = String(m.uid);
        const medalLevel = extractMedalLevel(m);
        const guardLevel = extractGuardLevel(m);
        const username = m.name || m.username || m.uname || '';
        insert.run(uidStr, guardLevel, medalLevel, username, updateTime);
    }
    
    db.prepare(`
        INSERT OR REPLACE INTO guard_cache_stats (id, total_count, api_total_count, update_time)
        VALUES (1, ?, ?, ?)
    `).run(members.length, apiTotalCount, updateTime);
    
    console.log(`✅ 缓存已更新，共 ${members.length} 条记录 (API报告: ${apiTotalCount})`);

    // 同步大航海等级到 user 表
    const update = db.prepare(`
        UPDATE user SET medal_level = ? WHERE bilibili_uid = ?
    `);
    let synced = 0;
    for (const m of members) {
        const uidStr = String(m.uid);
        const medalLevel = extractMedalLevel(m);
        const result = update.run(medalLevel, uidStr);
        if (result.changes > 0) synced++;
    }
    console.log(`✅ 已同步 ${synced} 个用户的大航海等级到 user 表`);
}

export async function refreshGuardCache() {
    if (!db) initDatabase();
    let cookie = '';
    try {
        const row = db.prepare('SELECT cookie FROM bilibili_account WHERE id = 1').get();
        if (row && row.cookie) cookie = row.cookie;
    } catch (e) {
        console.warn('读取 Cookie 失败，将不使用 Cookie');
    }
    console.log('🔄 手动刷新粉丝牌缓存...');
    const result = await fetchAllGuards(cookie);
    const now = Math.floor(Date.now() / 1000);
    saveCache(result.members, now, result.totalCount);
    console.log(`✅ 手动刷新完成，共 ${result.members.length} 条粉丝牌数据 (API报告: ${result.totalCount})`);
}

export function startGuardCacheJob() {
    if (!db) initDatabase();
    let cookie = '';
    try {
        const row = db.prepare('SELECT cookie FROM bilibili_account WHERE id = 1').get();
        if (row && row.cookie) cookie = row.cookie;
    } catch (e) {
        console.warn('读取 Cookie 失败，将不使用 Cookie');
    }

    console.log('🔄 首次更新粉丝牌缓存...');
    fetchAllGuards(cookie).then(result => {
        const now = Math.floor(Date.now() / 1000);
        saveCache(result.members, now, result.totalCount);
        console.log(`✅ 首次更新完成，共 ${result.members.length} 条粉丝牌数据`);
    }).catch(err => console.error('首次更新失败', err));

    schedule.scheduleJob('0 3 * * 0', async () => {
        console.log('🕒 定时任务：开始更新粉丝牌缓存');
        try {
            const result = await fetchAllGuards(cookie);
            const now = Math.floor(Date.now() / 1000);
            saveCache(result.members, now, result.totalCount);
            console.log(`✅ 定时更新完成，共 ${result.members.length} 条粉丝牌数据`);
        } catch (err) {
            console.error('更新粉丝牌缓存失败', err);
        }
    });
}

// 直接运行脚本时执行一次
if (process.argv[1] && process.argv[1].endsWith('updateGuardCache.js')) {
    refreshGuardCache().catch(console.error);
}