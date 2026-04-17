import axios from 'axios';

/**
 * 获取B站用户信息（昵称和头像）
 * @param {string|number} uid B站UID
 * @returns {Promise<{name: string, avatar: string} | null>}
 */
export async function getBilibiliUserInfo(uid) {
    // 从数据库获取保存的Cookie（如果有）
    let cookie = '';
    try {
        const row = global.db.prepare('SELECT cookie FROM bilibili_account WHERE id = 1').get();
        if (row && row.cookie) cookie = row.cookie;
    } catch(e) {
        console.warn('读取bilibili_account表失败', e.message);
    }

    try {
        const res = await axios.get(`https://api.bilibili.com/x/space/acc/info?mid=${uid}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                ...(cookie && { Cookie: cookie })
            },
            timeout: 10000
        });
        if (res.data.code === 0 && res.data.data) {
            let avatar = res.data.data.face;
            if (avatar && avatar.startsWith('http://')) {
                avatar = avatar.replace('http://', 'https://');
            }
            return {
                name: res.data.data.name,
                avatar: avatar
            };
        } else {
            console.error(`B站API返回错误: code=${res.data.code}, message=${res.data.message}`);
            return null;
        }
    } catch (err) {
        console.error('获取B站用户信息失败', err.message);
        return null;
    }
}

/**
 * 从缓存表中获取大航海身份（不再实时请求B站）
 * @param {string|number} uid B站UID
 * @returns {string}
 */
export async function getBilibiliMedal(uid) {
    try {
        const row = global.db.prepare('SELECT guard_level FROM guard_cache WHERE uid = ?').get(uid);
        if (!row) return '未上供';
        const levelMap = { 1: '总督', 2: '提督', 3: '舰长' };
        return levelMap[row.guard_level] || '未上供';
    } catch (err) {
        console.error('获取大航海身份失败', err);
        return '未上供';
    }
}