import schedule from 'node-schedule';
import { getBilibiliMedal } from './bilibiliUser.js';

export function startBadgeUpdateJob() {
    // 每天凌晨 3 点执行
    schedule.scheduleJob('0 3 * * *', async () => {
        console.log('开始更新所有用户的 badge...');
        const users = global.db.prepare('SELECT id, bilibili_uid FROM user WHERE bilibili_uid IS NOT NULL').all();
        for (const user of users) {
            try {
                const badge = await getBilibiliMedal(user.bilibili_uid);
                global.db.prepare('UPDATE user SET badge = ? WHERE id = ?').run(badge, user.id);
                console.log(`用户 ${user.id} (${user.bilibili_uid}) badge 更新为 ${badge}`);
            } catch (err) {
                console.error(`更新用户 ${user.id} 失败`, err);
            }
            // 避免请求过快，暂停1秒
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('badge 更新完成');
    });
}