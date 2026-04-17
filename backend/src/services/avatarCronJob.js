import { autoUpdateAvatars } from './avatarService.js';

export function startAvatarCronJob() {
    logger.info('启动头像自动更新定时任务...');

    setTimeout(async () => {
        try {
            const result = await autoUpdateAvatars();
            logger.info('首次头像自动更新完成:', result);
        } catch (error) {
            logger.error('首次头像自动更新失败:', error);
        }
    }, 5000);

    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    setInterval(async () => {
        try {
            logger.info('执行定时头像自动更新任务...');
            const result = await autoUpdateAvatars();
            logger.info('定时头像自动更新完成:', result);
        } catch (error) {
            logger.error('定时头像自动更新失败:', error);
        }
    }, THREE_DAYS);

    logger.info('头像自动更新定时任务已启动，每3天执行一次');
}

export async function triggerManualAvatarUpdate() {
    logger.info('手动触发头像更新...');
    return await autoUpdateAvatars();
}
