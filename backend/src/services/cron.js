import schedule from 'node-schedule';
import db from '../components/sql.js';

// 每天早上6点执行
schedule.scheduleJob('0 6 * * *', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const threshold = Math.floor(yesterday.getTime() / 1000);
    // 删除 created_at 小于阈值的 checkin 记录（保留排行榜统计，但心情墙只显示当天）
    // 为了排行榜数据不丢失，我们不删除 checkin 表，而是前端查询时只显示当天的。
    // 但心情墙接口已经限定当天，不需要删除。
    // 我们只需删除过期的心情消息（如果单独存了表），但 checkin 表包含心情，不能删。
    // 因此，我们修改心情墙接口只返回当天的，自然实现24小时。
    console.log('每日心情刷新任务执行');
});