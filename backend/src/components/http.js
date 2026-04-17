import express from 'express';
import cors from "cors";
import path from 'path';
import { read_json } from "../method/read.js"
import { getFile } from '../services/file.js';
import audioRoutes from '../routes/audio.js';
import albumRoutes from '../routes/album.js';
import adminRoutes from '../routes/admin.js';
// import superAdminRoutes from '../routes/super-admin.js'; // 该模块可能不存在，暂时注释
import userRoutes from '../routes/user.js';
import bilibiliRoutes from '../routes/bilibili.js';
// import aiRoutes from '../routes/ai.js'; // 该模块可能不存在，暂时注释
import announcementRoutes from '../routes/announcement.js';
import planDocumentRoutes from '../routes/planDocument.js';
import checkinRoutes from '../routes/checkin.js';
import chatRoomRoutes from '../routes/chatRoom.js';
import userCenterRoutes from '../routes/userCenter.js';
import bilibiliAuthRoutes from '../routes/bilibiliAuth.js';
import cinemaRoutes from '../routes/cinema.js';                     // 放映厅占用接口
import bilibiliVideoRoutes from '../routes/bilibiliVideo.js';       // 审核BV管理接口
import avatarRoutes from '../routes/avatar.js';                     // 头像管理路由
import { startGuardCacheJob } from '../services/updateGuardCache.js';   // 定时更新大航海缓存
import { startAvatarSyncJob } from '../services/avatarSyncJob.js';     // 头像自动同步定时任务（15天）
import { startAvatarCronJob } from '../services/avatarCronJob.js';     // 头像自动同步定时任务（3天）
import chalk from 'chalk';

export default async () => {
    const appConfig = read_json("configs", "config")

    const App = express();

    // 跨域白名单配置，只允许配置的域名访问
    App.use(cors({
        origin: (origin, callback) => {
            const domainName = appConfig.domainName; //允许的域名
            const allow = !origin || domainName.includes(origin)
            if (!allow) logger.warn(`拒绝跨域请求:${origin}`);
            callback(null, allow);
        }
    }));
    App.use(express.json());
    App.use('/api/file/data/document/images/ChatRoom', express.static('data/document/images/ChatRoom'));
    App.use('/uploads/chatRoom', (req, res) => { res.redirect(301, req.originalUrl.replace('/uploads/chatRoom', '/api/file/data/document/images/ChatRoom')) });
    App.use(express.urlencoded({ extended: false }));
    // 请求日志中间件
    App.use((req, res, next) => {
        const clientIp = req.headers["x-forwarded-for"] || req.ip;
        logger.info(`${req.method}://${clientIp}${req.url}`);
        // 只在未设置Content-Type时设置为text/plain，避免覆盖文件服务的MIME类型
        if (!res.get('Content-Type')) {
            res.set("Content-Type", "text/plain; charset=utf-8");
        }
        next();
    });

    // 集成路由
    App.use('/api', audioRoutes);
    App.use('/api', albumRoutes);
    App.use('/api', announcementRoutes); // 公告相关路由
    App.use('/api', planDocumentRoutes); // 企划文档相关路由
    App.use('/api/admin', adminRoutes);
    // App.use('/api/super-admin', superAdminRoutes); // 模块缺失，暂时禁用
    App.use('/api/bilibili', bilibiliRoutes); // Bilibili API 代理路由
    // App.use('/api/ai', aiRoutes); // 模块缺失，暂时禁用
    App.use('/api/checkin', checkinRoutes); // 打卡相关路由
    App.use('/api/chatRoom', chatRoomRoutes);  // 神乐动态路由
    App.use('/api/user', userCenterRoutes);   // 个人中心路由
    App.use('/api/bilibili/auth', bilibiliAuthRoutes);   // B站授权路由（二维码登录等）
    App.use('/api/cinema', cinemaRoutes);     // 新增：放映厅占用相关接口
    App.use('/api/bilibili/video', bilibiliVideoRoutes); // 审核BV接口
    App.use('/api/avatar', avatarRoutes);     // 新增：头像管理路由

    // 静态文件服务 - 本地头像图片
    App.use('/api/images/avatar', express.static('/var/www/oiwiki/backend/data/document/images/avatar'));

    // 通过url获取/data/document下的文件 - 必须在用户路由之前
    App.get('/api/file/*', async (req, res) => {
        const filePath = req.params[0]; // 获取路径参数
        const result = await getFile(filePath, req, res);

        // 如果服务失败，返回错误信息
        if (!result.success) {
            return res.status(result.code).json({
                code: result.code,
                message: result.message
            });
        }
    });

    // 兼容nginx代理后的请求（/api前缀被nginx去掉）
    App.get('/file/*', async (req, res) => {
        const filePath = req.params[0]; // 获取路径参数
        const result = await getFile(filePath, req, res);

        // 如果服务失败，返回错误信息
        if (!result.success) {
            return res.status(result.code).json({
                code: result.code,
                message: result.message
            });
        }
    });

    App.use('/api', userRoutes); // 用户相关路由（登录、注册等）


    const PORT = appConfig.httpPort;
    App.listen(PORT, () => {
        logger.info(chalk.white('HTTP服务器启动成功: ' + chalk.blue(`http://localhost:${PORT}`)));
        // 启动大航海缓存定时任务（每周日自动更新）
        startGuardCacheJob();
       // 启动头像自动同步定时任务（每15天执行一次）
        startAvatarSyncJob();
        // 启动头像自动更新定时任务（每3天执行一次）
        startAvatarCronJob();
    });
}