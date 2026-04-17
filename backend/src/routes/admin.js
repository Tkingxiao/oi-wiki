import express from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { createAdminValidatedRouteHandler, createAdminRoute } from '../method/route-helpers.js';
import {
    getAudiosForAdmin,
    reviewAudio,
    updateAudio,
    deleteAudio,
    updateAudioClassification,
    deleteAudioClassification,
    createAudioClassification
} from '../services/audio.js';
import {
    getAlbumsForAdmin,
    reviewAlbum,
    updateAlbum,
    deleteAlbum,
    reviewPhoto,
    updatePhoto,
    deletePhoto,
    createAlbum
} from '../services/album.js';
import {
    getPlanDocumentsForAdmin,
    deletePlanDocument,
    setCurrentPlanDocument
} from '../services/planDocument.js';
import { sendVerificationCode } from '../services/user.js';
import { authenticateToken, requirePermission } from '../method/auth.js';

const router = express.Router();

// ==================== 辅助函数：删除用户的所有物理文件 ====================
async function deleteUserPhysicalFiles(userId) {
    const cwd = process.cwd();

    // 1. 删除用户上传的音频文件
    const audios = global.db.prepare('SELECT url FROM audio WHERE user_id = ?').all(userId);
    for (const audio of audios) {
        if (audio.url) {
            const filePath = path.join(cwd, audio.url);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除音频文件: ${filePath}`);
                }
            } catch (err) { console.error(`删除音频文件失败: ${filePath}`, err); }
        }
    }

    // 2. 删除用户上传的照片
    const photos = global.db.prepare('SELECT url FROM photo WHERE user_id = ?').all(userId);
    for (const photo of photos) {
        if (photo.url) {
            const filePath = path.join(cwd, photo.url);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除照片文件: ${filePath}`);
                }
            } catch (err) { console.error(`删除照片文件失败: ${filePath}`, err); }
        }
    }

    // 3. 删除用户上传的企划文档
    const docs = global.db.prepare('SELECT file_path FROM plan_document WHERE uploader_id = ?').all(userId);
    for (const doc of docs) {
        if (doc.file_path) {
            const filePath = path.join(cwd, 'data', 'document', doc.file_path);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除企划文档: ${filePath}`);
                }
            } catch (err) { console.error(`删除企划文档失败: ${filePath}`, err); }
        }
    }

    // 4. 删除用户动态中的图片
    const postImages = global.db.prepare(`
        SELECT pi.image_url FROM ga_post_image pi
        JOIN ga_post p ON pi.post_id = p.id
        WHERE p.user_id = ?
    `).all(userId);
    for (const img of postImages) {
        if (img.image_url) {
            const filePath = path.join(cwd, img.image_url.replace(/^\//, ''));
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除动态图片: ${filePath}`);
                }
            } catch (err) { console.error(`删除动态图片失败: ${filePath}`, err); }
        }
    }

    // 5. 删除用户评论中的图片
    const commentImages = global.db.prepare('SELECT image_url FROM ga_comment WHERE user_id = ? AND image_url IS NOT NULL').all(userId);
    for (const img of commentImages) {
        if (img.image_url) {
            const filePath = path.join(cwd, img.image_url.replace(/^\//, ''));
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除评论图片: ${filePath}`);
                }
            } catch (err) { console.error(`删除评论图片失败: ${filePath}`, err); }
        }
    }

    // 6. 删除用户头像（非默认）
    const user = global.db.prepare('SELECT avatar FROM user WHERE id = ?').get(userId);
    if (user && user.avatar && user.avatar !== '/uploads/avatars/default.png') {
        const avatarPath = path.join(cwd, user.avatar.replace(/^\//, ''));
        try {
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
                console.log(`已删除头像: ${avatarPath}`);
            }
        } catch (err) { console.error(`删除头像失败: ${avatarPath}`, err); }
    }
}

// ========== 音声管理 ==========
router.get('/audios', ...createAdminRoute(getAudiosForAdmin, 2));

router.post('/audios/:id/review', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    is_review: { type: 'number', required: true, enum: [0, 1, 2] }
}, async (req) => {
    return await reviewAudio(req.params.id, req.body.is_review, req.user.id);
}, 2));

router.put('/audios/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    name: { required: false, minLength: 1, maxLength: 100 },
    classification_id: { type: 'id', required: false },
    new_classification_name: { required: false, minLength: 1, maxLength: 50 }
}, async (req) => {
    const { name, classification_id, new_classification_name } = req.body;

    let finalClassificationId = classification_id;

    if (new_classification_name?.trim()) {
        const createResult = await createAudioClassification(new_classification_name.trim(), req.user.id, req.user.permission);
        if (!createResult.success) {
            return createResult;
        }
        finalClassificationId = createResult.data.classificationId;
    }

    if (!finalClassificationId && !name?.trim()) {
        return {
            success: false,
            message: '请提供要更新的字段（名称、新分类名称或现有分类ID）',
            code: 400
        };
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (finalClassificationId !== undefined) updateData.classification_id = finalClassificationId;

    return await updateAudio(req.params.id, updateData, req.user.id);
}, 2));

router.delete('/audios/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true }
}, async (req) => {
    return await deleteAudio(req.params.id, req.user.id);
}, 2));

// 音声分类管理
router.put('/audio-classifications/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    name: { required: true, minLength: 1, maxLength: 50 }
}, async (req) => {
    return await updateAudioClassification(req.params.id, { name: req.body.name }, req.user.id);
}, 2));

router.delete('/audio-classifications/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true }
}, async (req) => {
    return await deleteAudioClassification(req.params.id, req.user.id);
}, 2));

// ========== 相册管理 ==========
router.get('/albums', ...createAdminRoute(getAlbumsForAdmin, 2));

router.post('/albums/:id/review', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    is_review: { type: 'number', required: true, enum: [0, 1, 2] }
}, async (req) => {
    return await reviewAlbum(req.params.id, req.body.is_review, req.user.id);
}, 2));

router.put('/albums/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    name: { required: false, minLength: 1, maxLength: 100 },
    introduction: { required: false, maxLength: 500 }
}, async (req) => {
    return await updateAlbum(req.params.id, req.body, req.user.id);
}, 2));

router.delete('/albums/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true }
}, async (req) => {
    return await deleteAlbum(req.params.id, req.user.id);
}, 2));

// 照片管理
router.post('/photos/:id/review', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    is_review: { type: 'number', required: true, enum: [0, 1, 2] }
}, async (req) => {
    return await reviewPhoto(req.params.id, req.body.is_review, req.user.id);
}, 2));

router.put('/photos/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true },
    name: { required: false, minLength: 1, maxLength: 100 },
    album_id: { type: 'id', required: false },
    new_album_name: { required: false, minLength: 1, maxLength: 100 },
    new_album_introduction: { required: false, maxLength: 500 }
}, async (req) => {
    const { name, album_id, new_album_name, new_album_introduction } = req.body;

    let finalAlbumId = album_id;

    if (new_album_name?.trim()) {
        const albumData = {
            name: new_album_name.trim(),
            introduction: new_album_introduction?.trim() || ''
        };
        const createResult = await createAlbum(albumData, req.user.id, req.user.permission);
        if (!createResult.success) {
            return createResult;
        }
        finalAlbumId = createResult.data.albumId;
    }

    if (!finalAlbumId && !name?.trim()) {
        return {
            success: false,
            message: '请提供要更新的字段（名称、新相册名称或现有相册ID）',
            code: 400
        };
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (finalAlbumId !== undefined) updateData.album_id = finalAlbumId;

    return await updatePhoto(req.params.id, updateData, req.user.id);
}, 2));

router.delete('/photos/:id', ...createAdminValidatedRouteHandler({
    id: { source: 'params', type: 'id', required: true }
}, async (req) => {
    return await deletePhoto(req.params.id, req.user.id);
}, 2));

// ========== 用户管理 ==========
router.get('/users', authenticateToken, requirePermission(2), (req, res) => {
    const currentUserPerm = req.user.permission;
    // 所有角色都可以查看所有用户列表，操作权限在按钮层面限制
    const sql = `
        SELECT 
            u.id, 
            u.name, 
            u.account_number, 
            u.email, 
            u.permission, 
            u.is_banned, 
            u.avatar, 
            u.create_time,
            u.badge,
            u.medal_level,
            COALESCE(gc.guard_level, 0) as guard_level
        FROM user u
        LEFT JOIN guard_cache gc ON u.bilibili_uid = gc.uid
        ORDER BY u.permission ASC, u.create_time DESC
    `;
    try {
        const users = global.db.prepare(sql).all();
        res.json(users);
    } catch (err) {
        console.error('获取黛言人列表失败:', err);
        res.status(500).json({ error: '获取黛言人列表失败，请检查服务器日志' });
    }
});

router.put('/users/:id/medal', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { medal_level } = req.body;
    const currentUser = req.user;
    const target = global.db.prepare('SELECT permission FROM user WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    // 权限检查：大神主(0)可操作所有人，神主(1)可操作神官(2)和黛言人(3)，神官(2)不可操作
    let canModify = false;
    if (currentUser.permission === 0) {
        canModify = true; // 大神主可操作所有人
    } else if (currentUser.permission === 1) {
        // 神主：不能操作自己和大神主
        if (parseInt(id) === currentUser.id) canModify = false;
        else if (target.permission === 0) canModify = false; // 不能对大神主操作
        else if (target.permission >= 2) canModify = true; // 可以操作神官和黛言人
    } else if (currentUser.permission === 2) {
        // 神官：不能操作自己、大神主、神主
        if (parseInt(id) === currentUser.id) canModify = false;
        else if (target.permission <= 1) canModify = false; // 不能对大神主、神主操作
        else if (target.permission >= 2) canModify = false; // 神官没有大航海设置权限
    }

    if (!canModify) {
        return res.status(403).json({ error: '无权限修改该用户的大航海等级' });
    }

    if (typeof medal_level !== 'number' || medal_level < 0 || medal_level > 80) {
        return res.status(400).json({ error: '等级必须为0-80的数字' });
    }

    try {
        const stmt = global.db.prepare('UPDATE guard_cache SET medal_level = ?, update_time = ? WHERE uid = (SELECT bilibili_uid FROM user WHERE id = ?)');
        const result = stmt.run(medal_level, Math.floor(Date.now() / 1000), id);
        if (result.changes === 0) {
            const user = global.db.prepare('SELECT bilibili_uid FROM user WHERE id = ?').get(id);
            if (user && user.bilibili_uid) {
                global.db.prepare('INSERT INTO guard_cache (uid, guard_level, medal_level, username, update_time) VALUES (?, ?, ?, ?, ?)')
                    .run(user.bilibili_uid, 0, medal_level, '', Math.floor(Date.now() / 1000));
            } else {
                return res.status(400).json({ error: '该用户未绑定B站UID，无法设置等级' });
            }
        }
        res.json({ success: true, message: '大航海等级已更新' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新失败' });
    }
});

router.put('/users/:id/badge', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { badge } = req.body;
    const currentUser = req.user;
    const target = global.db.prepare('SELECT permission FROM user WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    // 权限检查：与medal_level相同
    let canModify = false;
    if (currentUser.permission === 0) {
        canModify = true; // 大神主可操作所有人
    } else if (currentUser.permission === 1) {
        // 神主：不能操作自己和大神主
        if (parseInt(id) === currentUser.id) canModify = false;
        else if (target.permission === 0) canModify = false; // 不能对大神主操作
        else if (target.permission >= 2) canModify = true; // 可以操作神官和黛言人
    } else if (currentUser.permission === 2) {
        // 神官：没有大航海身份设置权限
        canModify = false;
    }

    if (!canModify) {
        return res.status(403).json({ error: '无权限修改该用户的大航海身份' });
    }

    const allowedBadges = ['未上供', '舰长', '提督', '总督'];
    if (!allowedBadges.includes(badge)) {
        return res.status(400).json({ error: '身份必须是: 未上供, 舰长, 提督, 总督' });
    }

    try {
        global.db.prepare('UPDATE user SET badge = ? WHERE id = ?').run(badge, id);
        res.json({ success: true, message: '大航海身份已更新' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新失败' });
    }
});

router.put('/users/:id/ban', authenticateToken, requirePermission(2), (req, res) => {
    const { id } = req.params;
    const { is_banned } = req.body;
    if (is_banned === undefined || (is_banned !== 0 && is_banned !== 1)) {
        return res.status(400).json({ error: '无效的封禁状态' });
    }
    const currentUser = req.user;
    const target = global.db.prepare('SELECT permission FROM user WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.permission <= currentUser.permission && currentUser.permission !== 0) {
        return res.status(403).json({ error: '无权操作该用户' });
    }
    global.db.prepare('UPDATE user SET is_banned = ? WHERE id = ?').run(is_banned, id);
    res.json({ success: true });
});

router.delete('/users/:id', authenticateToken, requirePermission(1), async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    const target = global.db.prepare('SELECT permission FROM user WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    
    // 权限检查：大神主(0)可以删除所有人(除了自己)，神主(1)只能删除神官及以下
    if (currentUser.permission === 1) {
        // 神主不能删除大神主
        if (target.permission === 0) {
            return res.status(403).json({ error: '神主无权删除大神主' });
        }
    }
    if (target.permission <= currentUser.permission && currentUser.permission !== 0) {
        return res.status(403).json({ error: '无权删除该用户' });
    }
    try {
        // 先删除用户的所有物理文件
        await deleteUserPhysicalFiles(id);
        // 再删除数据库中的用户记录（级联删除由外键处理）
        global.db.prepare('DELETE FROM user WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        console.error('删除用户时发生错误:', err);
        res.status(500).json({ error: '删除用户失败，请检查服务器日志' });
    }
});

router.put('/users/:id/permission', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { permission: newPerm } = req.body;
    const currentUser = req.user;
    const target = global.db.prepare('SELECT permission FROM user WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    // 权限检查
    let canModify = false;
    if (currentUser.permission === 0) {
        canModify = true; // 大神主可操作所有人
    } else if (currentUser.permission === 1) {
        // 神主：不能操作自己，不能修改大神主
        if (parseInt(id) === currentUser.id) canModify = false;
        else if (target.permission === 0) canModify = false; // 不能修改大神主
        else if (target.permission >= 1) canModify = true; // 可以修改神主、神官、黛言人
    } else {
        // 神官及以下：无法修改权限
        canModify = false;
    }

    if (!canModify) {
        return res.status(403).json({ error: '无权修改该用户权限' });
    }

    // 额外检查：神主只能授予/撤销神官(2)或黛言人(3)权限
    if (currentUser.permission === 1) {
        if (newPerm === 0) {
            return res.status(403).json({ error: '神主无法授予大神主权限' });
        }
    }

    if (![0, 1, 2, 3].includes(newPerm)) {
        return res.status(400).json({ error: '无效的权限值' });
    }

    global.db.prepare('UPDATE user SET permission = ? WHERE id = ?').run(newPerm, id);
    res.json({ success: true });
});

router.post('/users/:id/reset-password', authenticateToken, requirePermission(1), async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    const target = global.db.prepare('SELECT permission, email FROM user WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (currentUser.permission !== 0) {
        if (target.permission <= currentUser.permission) {
            return res.status(403).json({ error: '无权重置该用户密码' });
        }
    }
    const newPassword = Math.random().toString(36).slice(-8);
    const hashed = bcrypt.hashSync(newPassword, 10);
    global.db.prepare('UPDATE user SET password = ? WHERE id = ?').run(hashed, id);
    
    const { read_json } = await import('../method/read.js');
    const appConfig = read_json('configs', 'config');
    
    if (!global.emailTransporter) {
        return res.json({ success: false, message: '邮件服务不可用', code: 503 });
    }
    
    try {
        const mailOptions = {
            from: appConfig.email.from,
            to: target.email,
            subject: '密码已重置 - 黛棠OI-WIKI',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <p>您好！</p>
                    <p>您的密码已被管理员重置，新密码为：<strong style="font-size: 24px; color: #007bff;">${newPassword}</strong></p>
                    <p>请及时登录并修改密码。</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
                </div>
            `
        };
        await global.emailTransporter.sendMail(mailOptions);
        res.json({ success: true, message: '新密码已发送到用户邮箱' });
    } catch (emailError) {
        console.error('发送邮件失败:', emailError);
        res.json({ success: true, newPassword, message: '密码已重置，但邮件发送失败' });
    }
});

// ========== 企划表管理 ==========
router.get('/plan-documents', authenticateToken, requirePermission(2), async (req, res) => {
    try {
        const documents = await getPlanDocumentsForAdmin();
        res.json(documents);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取企划表失败' });
    }
});

router.delete('/plan-documents/:id', authenticateToken, requirePermission(2), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await deletePlanDocument(parseInt(id), req.user.id, req.user.permission);
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(result.code || 500).json({ error: result.message });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除失败' });
    }
});

router.put('/plan-documents/:id/current', authenticateToken, requirePermission(2), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await setCurrentPlanDocument(parseInt(id), req.user.id, req.user.permission);
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(result.code || 500).json({ error: result.message });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '设置失败' });
    }
});

// ========== B站视频管理（管理员及以上可访问） ==========
router.get('/bilibili/videos', authenticateToken, requirePermission(2), (req, res) => {
    try {
        const videos = global.db.prepare('SELECT * FROM bilibili_videos ORDER BY sort_order ASC, id DESC').all();
        res.json(videos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取视频列表失败' });
    }
});

router.post('/bilibili/videos', authenticateToken, requirePermission(2), (req, res) => {
    const { title, bvid, sort_order, status } = req.body;
    if (!title || !bvid) {
        return res.status(400).json({ error: '标题和BV号不能为空' });
    }
    try {
        const countStmt = global.db.prepare('SELECT COUNT(*) as count FROM bilibili_videos WHERE status = 1');
        const { count } = countStmt.get();
        const newStatus = status !== undefined ? status : 1;
        if (newStatus === 1 && count >= 5) {
            return res.status(400).json({ error: '最多只能添加5个启用的视频，请先禁用或删除其他视频' });
        }
        const created_at = Math.floor(Date.now() / 1000);
        const stmt = global.db.prepare('INSERT INTO bilibili_videos (title, bvid, sort_order, status, created_at) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(title, bvid, sort_order || 0, newStatus, created_at);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '添加视频失败，BV号可能已存在' });
    }
});

router.put('/bilibili/videos/:id', authenticateToken, requirePermission(2), (req, res) => {
    const { id } = req.params;
    const { title, bvid, sort_order, status } = req.body;
    try {
        if (status === 1) {
            const oldStmt = global.db.prepare('SELECT status FROM bilibili_videos WHERE id = ?');
            const oldVideo = oldStmt.get(id);
            if (!oldVideo) return res.status(404).json({ error: '视频不存在' });
            if (oldVideo.status !== 1) {
                const countStmt = global.db.prepare('SELECT COUNT(*) as count FROM bilibili_videos WHERE status = 1 AND id != ?');
                const { count } = countStmt.get(id);
                if (count >= 5) {
                    return res.status(400).json({ error: '最多只能启用5个视频，请先禁用其他视频' });
                }
            }
        }
        const updates = [];
        const values = [];
        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (bvid !== undefined) { updates.push('bvid = ?'); values.push(bvid); }
        if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
        if (status !== undefined) { updates.push('status = ?'); values.push(status); }
        if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
        values.push(id);
        const stmt = global.db.prepare(`UPDATE bilibili_videos SET ${updates.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新视频失败' });
    }
});

// 注意：此处的 DELETE /bilibili/videos/:id 已删除，避免与投稿审核部分的删除路由冲突

// ========== B站视频投稿审核接口 ==========
// 获取待审核投稿（status = 0）
router.get('/bilibili/videos/pending', authenticateToken, requirePermission(2), (req, res) => {
    try {
        const list = global.db.prepare(`
            SELECT id, user_id, user_name, user_avatar, bv, note, created_at, title
            FROM video_submissions
            WHERE status = 0
            ORDER BY created_at DESC
        `).all();
        res.json({ success: true, data: list });
    } catch (err) {
        console.error('获取待审核投稿失败:', err);
        res.status(500).json({ error: '获取失败' });
    }
});

// 获取已审核通过投稿（status = 1）
router.get('/bilibili/videos/audited', authenticateToken, requirePermission(2), (req, res) => {
    try {
        // 关联 audited_bv 获取标题
        const list = global.db.prepare(`
            SELECT vs.id, vs.user_id, vs.user_name, vs.user_avatar, vs.bv, vs.note, vs.updated_at, vs.title,
                   ab.title as audited_title
            FROM video_submissions vs
            LEFT JOIN audited_bv ab ON vs.bv = ab.bv
            WHERE vs.status = 1
            ORDER BY vs.updated_at DESC
        `).all();
        
        // 合并标题：优先使用 video_submissions.title，其次 audited_bv.title，最后用 bv
        const processedList = list.map(item => ({
            ...item,
            title: item.title || item.audited_title || item.bv
        }));
        
        res.json({ success: true, data: processedList });
    } catch (err) {
        console.error('获取已审核投稿失败:', err);
        res.status(500).json({ error: '获取失败' });
    }
});

// 审核通过（status 改为 1，并同步插入 audited_bv 表）
router.post('/bilibili/videos/:id/approve', authenticateToken, requirePermission(2), async (req, res) => {
    const { id } = req.params;
    try {
        const submission = global.db.prepare('SELECT * FROM video_submissions WHERE id = ?').get(id);
        if (!submission) {
            return res.status(404).json({ error: '投稿不存在' });
        }
        if (submission.status !== 0) {
            return res.status(400).json({ error: '该投稿已处理过' });
        }

        // 尝试获取视频标题 - 使用 getBilibiliVideoDetail API 精确查询
        let videoTitle = submission.bv; // 默认使用 BV 号
        
        // 优先从 B 站 API 获取标题
        try {
            const { getBilibiliVideoDetail } = await import('../services/bilibiliVideo.js');
            const detailResult = await getBilibiliVideoDetail(submission.bv);
            if (detailResult?.success && detailResult?.data?.title) {
                videoTitle = detailResult.data.title;
                console.log(`成功获取视频标题 [${submission.bv}]: ${videoTitle}`);
            }
        } catch (e) {
            console.error(`获取视频标题失败 [${submission.bv}]:`, e.message);
        }

        // 更新 video_submissions 的 title 和 status
        const updateStmt = global.db.prepare(`
            UPDATE video_submissions SET status = 1, title = ?, updated_at = strftime('%s','now') WHERE id = ?
        `);
        updateStmt.run(videoTitle, id);

        try {
            const insertStmt = global.db.prepare(`
                INSERT OR IGNORE INTO audited_bv (bv, note, title) VALUES (?, ?, ?)
            `);
            insertStmt.run(submission.bv, submission.note || '', videoTitle);
        } catch (e) {
            try {
                const insertStmt = global.db.prepare(`
                    INSERT OR IGNORE INTO audited_bv (bv, note) VALUES (?, ?)
                `);
                insertStmt.run(submission.bv, submission.note || '');
            } catch (e2) {
                console.error('同步到 audited_bv 失败:', e2);
            }
        }

        console.log(`视频审核通过 [ID=${id}, BV=${submission.bv}], 标题：${videoTitle}`);
        res.json({ success: true, message: '审核通过', title: videoTitle });
    } catch (err) {
        console.error('审核通过失败:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 拒绝投稿（status 改为 2）
router.post('/bilibili/videos/:id/reject', authenticateToken, requirePermission(2), (req, res) => {
    const { id } = req.params;
    try {
        const submission = global.db.prepare('SELECT * FROM video_submissions WHERE id = ?').get(id);
        if (!submission) {
            return res.status(404).json({ error: '投稿不存在' });
        }
        if (submission.status !== 0) {
            return res.status(400).json({ error: '该投稿已处理过' });
        }

        const updateStmt = global.db.prepare(`
            UPDATE video_submissions SET status = 2, updated_at = strftime('%s','now') WHERE id = ?
        `);
        updateStmt.run(id);
        res.json({ success: true, message: '已拒绝' });
    } catch (err) {
        console.error('拒绝投稿失败:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 删除已审核通过的投稿（同时从 audited_bv 中移除对应 BV）
router.delete('/bilibili/videos/:id', authenticateToken, requirePermission(2), (req, res) => {
    const { id } = req.params;
    try {
        const submission = global.db.prepare('SELECT * FROM video_submissions WHERE id = ?').get(id);
        if (!submission) {
            return res.status(404).json({ error: '投稿不存在' });
        }
        if (submission.status !== 1) {
            return res.status(400).json({ error: '只能删除已审核通过的投稿' });
        }

        const deleteStmt = global.db.prepare('DELETE FROM video_submissions WHERE id = ?');
        deleteStmt.run(id);

        try {
            const delAuditStmt = global.db.prepare('DELETE FROM audited_bv WHERE bv = ?');
            delAuditStmt.run(submission.bv);
        } catch (e) {
            console.error('从 audited_bv 删除失败:', e);
        }

        res.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('删除投稿失败:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// ========== 用户自定义标签管理（管理员及以上可访问） ==========
router.put('/user/:id/tag', authenticateToken, requirePermission(2), (req, res) => {
    const { id } = req.params;
    const { custom_tag } = req.body;
    if (custom_tag === undefined || custom_tag === null) {
        return res.status(400).json({ error: '请提供自定义标签内容' });
    }
    if (custom_tag.length > 20) {
        return res.status(400).json({ error: '标签长度不能超过20字符' });
    }
    try {
        global.db.prepare('UPDATE user SET custom_tag = ? WHERE id = ?').run(custom_tag, id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '设置标签失败' });
    }
});

// ========== 手动刷新大航海缓存 ==========
router.post('/refresh-guard-cache', authenticateToken, requirePermission(0), async (req, res) => {
    try {
        const { refreshGuardCache } = await import('../services/updateGuardCache.js');
        await refreshGuardCache();
        res.json({ success: true, message: '大航海缓存已更新' });
    } catch (err) {
        console.error('刷新大航海缓存失败:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== 获取粉丝牌缓存数据 ==========
router.get('/guard-cache', authenticateToken, requirePermission(0), (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 0;

        // 获取本地存储的总数
        const statsResult = global.db.prepare('SELECT total_count, api_total_count FROM guard_cache_stats WHERE id = 1').get();
        const dbTotal = statsResult?.total_count || 0;
        const apiTotal = statsResult?.api_total_count || 0;

        let data;
        if (pageSize > 0) {
            const offset = (page - 1) * pageSize;
            data = global.db.prepare(`
                SELECT uid, guard_level, medal_level, username, update_time 
                FROM guard_cache 
                ORDER BY guard_level DESC, medal_level DESC, uid ASC
                LIMIT ? OFFSET ?
            `).all(pageSize, offset);
        } else {
            data = global.db.prepare(`
                SELECT uid, guard_level, medal_level, username, update_time 
                FROM guard_cache 
                ORDER BY guard_level DESC, medal_level DESC, uid ASC
            `).all();
        }

        const maxUpdate = global.db.prepare('SELECT MAX(update_time) as update_time FROM guard_cache').get();
        res.json({ 
            data, 
            update_time: maxUpdate?.update_time || null,
            total: dbTotal,
            api_total: apiTotal,
            page,
            pageSize
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取大航海数据失败' });
    }
});

export default router;