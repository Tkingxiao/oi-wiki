import axios from 'axios';

/**
 * 根据 B 站 UID 获取用户昵称和头像 URL（外链）
 * @param {string|number} uid 
 * @returns {Promise<{name: string, avatar: string}>}
 */
export async function getBiliUserInfo(uid) {
    try {
        const response = await axios.get(`https://api.bilibili.com/x/space/acc/info?mid=${uid}`, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (response.data.code === 0 && response.data.data) {
            let avatar = response.data.data.face;
            if (avatar && avatar.startsWith('http://')) {
                avatar = avatar.replace('http://', 'https://');
            }
            return {
                name: response.data.data.name,
                avatar: avatar
            };
        } else {
            throw new Error(response.data.message || '获取失败');
        }
    } catch (err) {
        console.error('从B站获取用户信息失败:', err.message);
        throw err;
    }
}