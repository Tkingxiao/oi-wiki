import path from 'path';
import fs from 'fs';
import { fileExists } from '../method/file-utils.js';
import { queryOne, queryAll, insert, update, remove, softDelete } from '../method/database.js';
import { uploadToCOS, deleteFromCOS, generateCOSKey, isCOSUrl, extractKeyFromCOSUrl, isCOSAvailable } from './cos.js';

/**
 * 相册服务 - 处理相册和照片相关的业务逻辑
 * 支持本地存储和腾讯云 COS 对象存储双模式
 */

export async function getAlbumsWithLatestPhotos() {
    try {
        const albums = queryAll(`
            SELECT pa.id, pa.name, pa.introduction, pa.create_time, u.name as user_name
            FROM photo_album pa
            LEFT JOIN user u ON pa.user_id = u.id
            WHERE pa.is_deleted = 0 AND pa.is_review = 1
            ORDER BY pa.create_time DESC
        `);
        const photoAlbums = [];
        for (const album of albums) {
            const photoCountResult = queryOne(`SELECT COUNT(*) as count FROM photo WHERE album_id = ? AND is_deleted = 0 AND is_review = 1`, [album.id]);
            const photoCount = photoCountResult ? photoCountResult.count : 0;
            const latestPhoto = queryOne(`SELECT url FROM photo WHERE album_id = ? AND is_deleted = 0 AND is_review = 1 ORDER BY create_time DESC LIMIT 1`, [album.id]);
            let img = '';
            if (latestPhoto && (isCOSUrl(latestPhoto.url) || fileExists(latestPhoto.url))) img = isCOSUrl(latestPhoto.url) ? latestPhoto.url : `/api/file/${latestPhoto.url}`;
            photoAlbums.push({ id: album.id, title: album.name, img, tip: album.introduction || '', photoCount });
        }
        const latestPhotos = queryAll(`
            SELECT p.id, p.album_id, p.name, p.url, pa.name as album_name
            FROM photo p
            LEFT JOIN photo_album pa ON p.album_id = pa.id
            WHERE p.is_deleted = 0 AND p.is_review = 1 AND pa.is_deleted = 0 AND pa.is_review = 1
            ORDER BY p.create_time DESC LIMIT 24
        `);
        const processedLatestPhotos = latestPhotos.filter(photo => isCOSUrl(photo.url) || fileExists(photo.url)).map(photo => ({
            id: photo.id, photoAlbumId: photo.album_id, title: photo.name, img: isCOSUrl(photo.url) ? photo.url : `/api/file/${photo.url}`
        }));
        const result = { photoAlbum: photoAlbums, latestPhotos: processedLatestPhotos };
        logger.info(`获取相册数据：${photoAlbums.length}个相册，${processedLatestPhotos.length}张最新照片`);
        return { success: true, message: '获取相册数据成功', data: result };
    } catch (error) {
        logger.error('获取相册数据失败:', error);
        return { success: false, message: '获取相册数据失败', code: 500 };
    }
}

export async function getPhotos(albumId) {
    try {
        const album = queryOne(`SELECT id, name, introduction, is_deleted, is_review FROM photo_album WHERE id = ? AND is_deleted = 0 AND is_review = 1`, [albumId]);
        if (!album) return { success: false, message: '相册不存在或未审核通过', code: 404 };
        const photos = queryAll(`SELECT p.id, p.name, p.url FROM photo p WHERE p.album_id = ? AND p.is_deleted = 0 AND p.is_review = 1`, [albumId]);
        const processedPhotos = photos.filter(photo => isCOSUrl(photo.url) || fileExists(photo.url)).map(photo => ({ id: photo.id, name: photo.name, url: isCOSUrl(photo.url) ? photo.url : `/api/file/${photo.url}` }));
        logger.info(`获取照片列表：相册 ${albumId}(${album.name}), 共${processedPhotos.length}张照片`);
        return { success: true, message: '获取照片列表成功', data: { album: { id: album.id, name: album.name, introduction: album.introduction || '' }, photos: processedPhotos } };
    } catch (error) {
        logger.error('获取照片列表失败:', error);
        return { success: false, message: '获取照片列表失败', code: 500 };
    }
}

export async function createAlbum(albumData, userId, userPermission) {
    const { name, introduction } = albumData;
    try {
        if (!name || name.trim().length === 0) return { success: false, message: '相册名称不能为空' };
        if (name.length > 100) return { success: false, message: '相册名称不能超过 100 个字符' };
        if (introduction && introduction.length > 500) return { success: false, message: '相册简介不能超过 500 个字符' };
        const existingAlbum = queryOne(`SELECT id FROM photo_album WHERE name = ? AND is_deleted = 0`, [name.trim()]);
        if (existingAlbum) return { success: false, message: '该相册名称已存在' };
        const isReview = 1;
        const currentTime = Math.floor(Date.now() / 1000);
        const result = insert(`INSERT INTO photo_album (user_id, name, introduction, is_review, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)`, [userId, name.trim(), introduction?.trim() || '', isReview, currentTime, currentTime]);
        logger.info(`相册创建成功：${name} by user ${userId} (直接审核通过)`);
        return { success: true, message: '相册创建成功', data: { albumId: result.lastInsertRowid, name: name.trim(), introduction: introduction?.trim() || '', isReview } };
    } catch (error) {
        logger.error('相册创建失败:', error);
        return { success: false, message: '相册创建失败，请稍后重试', code: 500 };
    }
}

export async function uploadPhoto(file, photoData, userId, userPermission, albumInfo, uploadDir) {
    const { albumId, name } = photoData;
    try {
        if (!albumId) return { success: false, message: '相册 ID 不能为空' };
        if (!name || name.trim().length === 0) return { success: false, message: '照片名称不能为空' };
        
        // 使用传入的相册信息或查询数据库
        const album = albumInfo || queryOne(`SELECT id, name, is_deleted, is_review FROM photo_album WHERE id = ? AND is_deleted = 0 AND is_review = 1`, [albumId]);
        if (!album) return { success: false, message: '相册不存在或未审核通过' };
        if (!file) return { success: false, message: '请上传照片文件' };
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) return { success: false, message: '不支持的文件类型，只允许上传图片文件' };
        
        // 构建文件路径 - 支持 COS 和本地存储
        const fileName = path.basename(file.path);
        const safeAlbumName = album.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
        const albumFolderName = `${album.id}_${safeAlbumName}`;
        
        let finalUrl;
        if (isCOSAvailable()) {
            const cosKey = generateCOSKey('album', albumFolderName, fileName);
            const fileBuffer = file.buffer || fs.readFileSync(file.path);
            finalUrl = await uploadToCOS(fileBuffer, cosKey, file.mimetype);
            logger.info(`照片已上传到 COS: ${cosKey}`);
            
            if (file.path && !file.buffer) {
                try { fs.unlinkSync(file.path); } catch (e) { logger.warn('删除临时照片文件失败:', e.message); }
            }
        } else {
            const filePath = path.join('images', 'album', albumFolderName, fileName).replace(/\\/g, '/');
            finalUrl = filePath;
        }
        
        const isReview = userPermission <= 2 ? 1 : 0;
        const currentTime = Math.floor(Date.now() / 1000);
        const result = insert(`INSERT INTO photo (album_id, user_id, name, url, is_review, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)`, [albumId, userId, name.trim(), finalUrl, isReview, currentTime, currentTime]);
        const message = isReview === 1 ? '照片上传成功' : '照片上传成功，等待审核';
        logger.info(`照片上传成功：${name} (${fileName}) to album ${albumId} by user ${userId} (审核状态：${isReview}, 存储：${isCOSAvailable() ? 'COS' : '本地'})`);
        return { success: true, message, data: { photoId: result.lastInsertRowid, name: name.trim(), url: finalUrl, album: album.name, isReview } };
    } catch (error) {
        logger.error('照片上传失败:', error);
        return { success: false, message: '照片上传失败，请稍后重试', code: 500 };
    }
}

export async function getAlbumsForAdmin() {
    try {
        const albums = queryAll(`
            SELECT pa.id, pa.user_id, pa.name, pa.introduction, pa.is_review, pa.create_time, pa.update_time, u.name as user_name
            FROM photo_album pa LEFT JOIN user u ON pa.user_id = u.id WHERE pa.is_deleted = 0 ORDER BY pa.create_time DESC
        `);
        const albumTags = [];
        for (const album of albums) {
            const photos = queryAll(`SELECT p.id, p.album_id, p.user_id, p.name, p.url, p.is_review, p.create_time, p.update_time, u.name as user_name FROM photo p LEFT JOIN user u ON p.user_id = u.id WHERE p.album_id = ? AND p.is_deleted = 0 ORDER BY p.create_time DESC`, [album.id]);
            const processedPhotos = photos.map(photo => ({ id: photo.id, album_id: photo.album_id, user_id: photo.user_id, user_name: photo.user_name, name: photo.name, url: isCOSUrl(photo.url) ? photo.url : `/api/file/${photo.url}`, is_review: photo.is_review, create_time: photo.create_time, update_time: photo.update_time }));
            albumTags.push({ id: album.id, user_id: album.user_id, user_name: album.user_name, name: album.name, introduction: album.introduction || '', is_review: album.is_review, create_time: album.create_time, update_time: album.update_time, photos: processedPhotos });
        }
        logger.info(`获取相册管理数据：${albumTags.length}个相册`);
        return { success: true, message: '获取相册管理数据成功', data: albumTags };
    } catch (error) {
        logger.error('获取相册管理数据失败:', error);
        return { success: false, message: '获取相册管理数据失败', code: 500 };
    }
}

export async function reviewAlbum(albumId, isReview, adminId) {
    try {
        if (![0, 1, 2].includes(isReview)) return { success: false, message: '无效的审核状态' };
        const album = queryOne(`SELECT id, name, is_review FROM photo_album WHERE id = ? AND is_deleted = 0`, [albumId]);
        if (!album) return { success: false, message: '相册不存在', code: 404 };
        const updateResult = update(`UPDATE photo_album SET is_review = ?, update_time = ? WHERE id = ?`, [isReview, Math.floor(Date.now() / 1000), albumId]);
        if (updateResult.changes === 0) return { success: false, message: '审核失败' };
        logger.info(`相册审核：ID ${albumId} 状态 ${album.is_review} -> ${isReview} by admin ${adminId}`);
        return { success: true, message: '相册审核成功', data: { albumId, oldReview: album.is_review, newReview: isReview } };
    } catch (error) {
        logger.error('相册审核失败:', error);
        return { success: false, message: '相册审核失败', code: 500 };
    }
}

export async function updateAlbum(albumId, updateData, adminId) {
    try {
        const { name, introduction } = updateData;
        if (!name || name.trim().length === 0) return { success: false, message: '相册名称不能为空' };
        const album = queryOne(`SELECT id, name, introduction FROM photo_album WHERE id = ? AND is_deleted = 0`, [albumId]);
        if (!album) return { success: false, message: '相册不存在', code: 404 };
        const updateFields = []; const updateValues = [];
        if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name.trim()); }
        if (introduction !== undefined) { updateFields.push('introduction = ?'); updateValues.push(introduction.trim()); }
        if (updateFields.length === 0) return { success: false, message: '没有需要更新的字段' };
        updateFields.push('update_time = ?'); updateValues.push(Math.floor(Date.now() / 1000)); updateValues.push(albumId);
        const updateResult = update(`UPDATE photo_album SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        if (updateResult.changes === 0) return { success: false, message: '相册更新失败' };
        logger.info(`相册更新：ID ${albumId} by admin ${adminId}`);
        return { success: true, message: '相册更新成功', data: { albumId, updatedFields: updateFields.filter(f => !f.includes('update_time')) } };
    } catch (error) {
        logger.error('相册更新失败:', error);
        return { success: false, message: '相册更新失败', code: 500 };
    }
}

export async function deleteAlbum(albumId, adminId) {
    try {
        const album = queryOne(`SELECT id, name, is_deleted FROM photo_album WHERE id = ?`, [albumId]);
        if (!album) return { success: false, message: '相册不存在', code: 404 };
        if (album.is_deleted) return { success: false, message: '相册已被删除', code: 400 };
        
        // 删除相册中的所有照片（包括 COS 和本地文件）
        const photos = queryAll(`SELECT id, url FROM photo WHERE album_id = ?`, [albumId]);
        for (const photo of photos) {
            if (photo.url) {
                if (isCOSUrl(photo.url)) {
                    const cosKey = extractKeyFromCOSUrl(photo.url);
                    if (cosKey) {
                        try { await deleteFromCOS(cosKey); } catch (fileErr) { logger.error(`删除 COS 照片文件失败：${cosKey}`, fileErr); }
                    }
                } else {
                    const filePath = path.join(process.cwd(), photo.url);
                    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (fileErr) { logger.error(`删除照片文件失败：${filePath}`, fileErr); }
                }
            }
        }
        
        // 删除相册文件夹（仅本地存储）
        const safeAlbumName = album.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 30);
        const albumFolderName = `${album.id}_${safeAlbumName}`;
        const albumFolderPath = path.join(process.cwd(), 'data', 'document', 'images', 'album', albumFolderName);
        try {
            if (fs.existsSync(albumFolderPath)) {
                fs.rmSync(albumFolderPath, { recursive: true, force: true });
                logger.info(`删除相册文件夹：${albumFolderPath}`);
            }
        } catch (folderErr) {
            logger.error(`删除相册文件夹失败：${albumFolderPath}`, folderErr);
        }
        
        global.db.prepare('DELETE FROM photo WHERE album_id = ?').run(albumId);
        const deleteResult = global.db.prepare('DELETE FROM photo_album WHERE id = ?').run(albumId);
        if (deleteResult.changes === 0) return { success: false, message: '相册删除失败', code: 500 };
        logger.info(`相册硬删除：ID ${albumId} (${album.name}) by admin ${adminId}, 同时删除了 ${photos.length} 张照片和相册文件夹`);
        return { success: true, message: '相册删除成功' };
    } catch (error) {
        logger.error('相册删除失败:', error);
        return { success: false, message: '相册删除失败', code: 500 };
    }
}

export async function reviewPhoto(photoId, isReview, adminId) {
    try {
        if (![0, 1, 2].includes(isReview)) return { success: false, message: '无效的审核状态' };
        const photo = queryOne(`SELECT id, name, is_review FROM photo WHERE id = ? AND is_deleted = 0`, [photoId]);
        if (!photo) return { success: false, message: '照片不存在', code: 404 };
        const updateResult = update(`UPDATE photo SET is_review = ?, update_time = ? WHERE id = ?`, [isReview, Math.floor(Date.now() / 1000), photoId]);
        if (updateResult.changes === 0) return { success: false, message: '审核失败' };
        logger.info(`照片审核：ID ${photoId} 状态 ${photo.is_review} -> ${isReview} by admin ${adminId}`);
        return { success: true, message: '照片审核成功', data: { photoId, oldReview: photo.is_review, newReview: isReview } };
    } catch (error) {
        logger.error('照片审核失败:', error);
        return { success: false, message: '照片审核失败', code: 500 };
    }
}

export async function updatePhoto(photoId, updateData, adminId) {
    try {
        const { name, album_id } = updateData;
        if (!name || name.trim().length === 0) return { success: false, message: '照片名称不能为空' };
        const photo = queryOne(`SELECT id, name, album_id FROM photo WHERE id = ? AND is_deleted = 0`, [photoId]);
        if (!photo) return { success: false, message: '照片不存在', code: 404 };
        if (album_id !== undefined) {
            const album = queryOne(`SELECT id FROM photo_album WHERE id = ? AND is_deleted = 0`, [album_id]);
            if (!album) return { success: false, message: '相册不存在' };
        }
        const updateFields = []; const updateValues = [];
        if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name.trim()); }
        if (album_id !== undefined) { updateFields.push('album_id = ?'); updateValues.push(album_id); }
        if (updateFields.length === 0) return { success: false, message: '没有需要更新的字段' };
        updateFields.push('update_time = ?'); updateValues.push(Math.floor(Date.now() / 1000)); updateValues.push(photoId);
        const updateResult = update(`UPDATE photo SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        if (updateResult.changes === 0) return { success: false, message: '照片更新失败' };
        logger.info(`照片更新：ID ${photoId} by admin ${adminId}`);
        return { success: true, message: '照片更新成功', data: { photoId, updatedFields: updateFields.filter(f => !f.includes('update_time')) } };
    } catch (error) {
        logger.error('照片更新失败:', error);
        return { success: false, message: '照片更新失败', code: 500 };
    }
}

export async function deletePhoto(photoId, adminId) {
    try {
        const photo = queryOne(`SELECT id, name, url, is_deleted FROM photo WHERE id = ?`, [photoId]);
        if (!photo) return { success: false, message: '照片不存在', code: 404 };
        if (photo.is_deleted) return { success: false, message: '照片已被删除', code: 400 };
        if (photo.url) {
            if (isCOSUrl(photo.url)) {
                const cosKey = extractKeyFromCOSUrl(photo.url);
                if (cosKey) {
                    try { await deleteFromCOS(cosKey); } catch (fileErr) { logger.error(`删除 COS 照片文件失败：${cosKey}`, fileErr); }
                }
            } else {
                const filePath = path.join(process.cwd(), photo.url);
                try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (fileErr) { logger.error(`删除照片文件失败：${filePath}`, fileErr); }
            }
        }
        const deleteResult = global.db.prepare('DELETE FROM photo WHERE id = ?').run(photoId);
        if (deleteResult.changes === 0) return { success: false, message: '照片删除失败', code: 500 };
        logger.info(`照片硬删除：ID ${photoId} (${photo.name}) by admin ${adminId}`);
        return { success: true, message: '照片删除成功' };
    } catch (error) {
        logger.error('照片删除失败:', error);
        return { success: false, message: '照片删除失败', code: 500 };
    }
}
