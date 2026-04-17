import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createPublicRoute, createValidatedRouteHandler, createAdminValidatedRouteHandler, createRouteHandler } from '../method/route-helpers.js';
import { getAlbumsWithLatestPhotos, getPhotos, createAlbum, uploadPhoto } from '../services/album.js';
import { authenticateToken, requirePermission } from '../method/auth.js';
import { queryOne } from '../method/database.js';

const router = express.Router();

// 获取相册和最新照片数据 (游客可访问)
router.get('/albums', ...createPublicRoute(getAlbumsWithLatestPhotos));

// 获取照片列表 (游客可访问)
router.get('/photos', ...createValidatedRouteHandler({
    album_id: { source: 'query', type: 'id', required: true }
}, async (req) => {
    return await getPhotos(req.query.album_id);
}));

// 创建相册 (需要登录，并传递 userPermission)
router.post('/albums', ...createAdminValidatedRouteHandler({
    name: { required: true, minLength: 1, maxLength: 100 },
    introduction: { required: false, maxLength: 500 }
}, async (req) => {
    const albumData = {
        name: req.body.name?.trim(),
        introduction: req.body.introduction?.trim()
    };

    // 传入 user.permission 以便服务层根据权限设置审核状态
    const result = await createAlbum(albumData, req.user.id, req.user.permission);
    if (result.success) {
        result.code = 201; // 创建成功
    }
    return result;
}, 3)); // 普通用户权限

// 使用内存存储，然后手动保存到相册文件夹
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.JPG', '.JPEG', '.PNG', '.GIF', '.WEBP'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error(`只允许上传${allowedTypes.join('、')}格式的文件`), false);
        }

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error(`只允许上传${allowedExtensions.join('、')}格式的文件`), false);
        }

        cb(null, true);
    }
});

// 上传照片 (需要登录) - 使用内存存储后手动保存到相册文件夹
router.post('/photos',
    authenticateToken,
    requirePermission(3),
    upload.single('photo'),
    createRouteHandler(async (req) => {
        const { album_id, name } = req.body;
        const file = req.file;

        if (!file) {
            return { success: false, message: '请上传照片文件', code: 400 };
        }

        const albumId = parseInt(album_id);
        if (!albumId) {
            return { success: false, message: '相册ID不能为空', code: 400 };
        }

        // 查询相册信息
        const album = queryOne(
            'SELECT id, name, is_deleted, is_review FROM photo_album WHERE id = ? AND is_deleted = 0',
            [albumId]
        );

        if (!album) {
            return { success: false, message: '相册不存在', code: 404 };
        }

        // 构建相册文件夹路径：images/album/相册ID_相册名
        const safeAlbumName = album.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
        const albumFolderName = `${album.id}_${safeAlbumName}`;
        const uploadDir = path.join(process.cwd(), 'data', 'document', 'images', 'album', albumFolderName);

        // 确保目录存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 生成唯一文件名
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        const filePath = path.join(uploadDir, uniqueName);

        // 保存文件
        fs.writeFileSync(filePath, file.buffer);

        // 构建模拟的file对象，供服务层使用
        const savedFile = {
            path: filePath,
            filename: uniqueName,
            mimetype: file.mimetype
        };

        const photoData = {
            albumId: albumId,
            name: name?.trim()
        };

        // 传递相册信息给服务层
        const result = await uploadPhoto(savedFile, photoData, req.user.id, req.user.permission, album, uploadDir);
        if (result.success) {
            result.code = 201; // 创建成功
        }
        return result;
    })
);

export default router;
