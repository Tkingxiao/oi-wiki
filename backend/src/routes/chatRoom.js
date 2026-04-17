import express from 'express';
import { authenticateToken } from '../method/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import sharp from 'sharp';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const router = express.Router();

function htmlToPlainText(html) {
    if (!html) return '';
    let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureFavoriteTable() {
    try {
        global.db.exec(`
            CREATE TABLE IF NOT EXISTS user_favorite_emojis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s','now')),
                FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
                UNIQUE(user_id, image_url)
            );
            CREATE INDEX IF NOT EXISTS idx_favorite_user ON user_favorite_emojis(user_id);
        `);
        console.log('✅ 收藏表已确保存在');
    } catch (err) {
        console.error('❌ 创建收藏表失败:', err.message);
    }
}
if (global.db) ensureFavoriteTable();

async function deleteWithRetry(filePath, retries = 3, delay = 100) {
    for (let i = 0; i < retries; i++) {
        try {
            await fs.unlink(filePath);
            return;
        } catch (err) {
            if (err.code === 'EBUSY' && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            console.error(`删除临时文件失败 (尝试 ${i+1}/${retries}):`, err.message);
        }
    }
}

async function addWatermark(inputPath, outputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === '.gif') {
        await fs.copyFile(inputPath, outputPath);
        return true;
    }
    try {
        const watermarkText = '© 黛棠OI';
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        const width = metadata.width;
        const height = metadata.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const fontSize = Math.min(width, height) * 0.08;

        const svgWatermark = `
            <svg width="${width}" height="${height}">
                <text x="50%" y="50%" 
                      text-anchor="middle" 
                      dominant-baseline="middle" 
                      transform="rotate(-30, ${centerX}, ${centerY})"
                      font-size="${fontSize}" 
                      fill="rgba(255,255,255,0.4)" 
                      font-family="Arial, sans-serif"
                      font-weight="bold">${watermarkText}</text>
            </svg>
        `;
        const watermarkBuffer = Buffer.from(svgWatermark);
        const compositeBuffer = await image.composite([{ input: watermarkBuffer, gravity: 'center' }]).toBuffer();
        await fs.writeFile(outputPath, compositeBuffer);
        return true;
    } catch (err) {
        console.error('水印添加失败:', err);
        return false;
    }
}

const CHATROOM_BASE = 'data/document/images/ChatRoom';
const CHATROOM_URL_BASE = '/api/file/data/document/images/ChatRoom';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `${CHATROOM_BASE}/temp`;
        if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'chatRoom-' + unique + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 3 * 1024 * 1024 } });

async function deleteImageFileByUrl(imageUrl) {
    if (!imageUrl) return;
    const relativePath = imageUrl.replace(/^\//, '');
    const fullPath = path.join(process.cwd(), relativePath);
    await deleteWithRetry(fullPath, 2, 50);
}

function sanitizeHtml(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div', 'img'],
        ALLOWED_ATTR: ['src', 'alt', 'class', 'style'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick']
    });
}

router.post('/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择图片' });
    try {
        const tempPath = req.file.path;
        const finalDir = CHATROOM_BASE;
        if (!fsSync.existsSync(finalDir)) fsSync.mkdirSync(finalDir, { recursive: true });
        const finalFilename = path.basename(req.file.filename);
        const finalPath = path.join(finalDir, finalFilename);
        await addWatermark(tempPath, finalPath);
        await deleteWithRetry(tempPath);
        const imageUrl = `${CHATROOM_URL_BASE}/${finalFilename}`;
        res.json({ success: true, url: imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '图片上传失败' });
    }
});

router.get('/favorite-emojis', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.json({ success: true, data: [] });
    }
    try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, global.appConfig.jwtSecret);
        const userId = decoded.id;
        const emojis = global.db.prepare('SELECT image_url FROM user_favorite_emojis WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        res.json({ success: true, data: emojis.map(e => e.image_url) });
    } catch (err) {
        res.json({ success: true, data: [] });
    }
});

router.post('/favorite-emojis', authenticateToken, upload.single('image'), async (req, res) => {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: '请选择图片' });
    const count = global.db.prepare('SELECT COUNT(*) as cnt FROM user_favorite_emojis WHERE user_id = ?').get(userId).cnt;
    if (count >= 10) return res.status(400).json({ error: '收藏已达上限（10个）' });
    try {
        const tempPath = req.file.path;
        const finalDir = `${CHATROOM_BASE}/favorites`;
        if (!fsSync.existsSync(finalDir)) fsSync.mkdirSync(finalDir, { recursive: true });
        const ext = path.extname(req.file.originalname);
        const finalFilename = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        const finalPath = path.join(finalDir, finalFilename);
        const watermarked = await addWatermark(tempPath, finalPath);
        if (!watermarked) {
            await fs.copyFile(tempPath, finalPath);
        }
        await deleteWithRetry(tempPath);
        const imageUrl = `${CHATROOM_URL_BASE}/favorites/${finalFilename}`;
        global.db.prepare('INSERT INTO user_favorite_emojis (user_id, image_url) VALUES (?, ?)').run(userId, imageUrl);
        res.json({ success: true, url: imageUrl });
    } catch (err) {
        console.error('添加收藏失败:', err);
        if (req.file && req.file.path) await deleteWithRetry(req.file.path).catch(() => {});
        res.status(500).json({ error: '添加收藏失败: ' + err.message });
    }
});

router.delete('/favorite-emojis', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: '缺少图片地址' });
    try {
        const result = global.db.prepare('DELETE FROM user_favorite_emojis WHERE user_id = ? AND image_url = ?').run(userId, imageUrl);
        if (result.changes === 0) return res.status(404).json({ error: '未找到收藏表情' });
        deleteImageFileByUrl(imageUrl).catch(e => console.error('删除物理文件失败', e));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除失败' });
    }
});

router.post('/post', authenticateToken, upload.array('images', 9), async (req, res) => {
    let { content } = req.body;
    const userId = req.user.id;
    const userPerm = req.user.permission;
    const now = Math.floor(Date.now() / 1000);
    content = sanitizeHtml(content);
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    const isAdmin = userPerm === 1 || userPerm === 2;
    if (!content || plainText === '') {
        return res.status(400).json({ error: '内容不能为空' });
    }
    if (!isAdmin && plainText.length > 1000) {
        return res.status(400).json({ error: '内容不能超过1000字' });
    }
    try {
        const stmt = global.db.prepare('INSERT INTO ga_post (user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)');
        const info = stmt.run(userId, content, now, now);
        const postId = info.lastInsertRowid;
        if (req.files && req.files.length) {
            const imgStmt = global.db.prepare('INSERT INTO ga_post_image (post_id, image_url, sort_order) VALUES (?, ?, ?)');
            const finalDir = CHATROOM_BASE;
            if (!fsSync.existsSync(finalDir)) fsSync.mkdirSync(finalDir, { recursive: true });
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const tempPath = file.path;
                const finalFilename = path.basename(file.filename);
                const finalPath = path.join(finalDir, finalFilename);
                await addWatermark(tempPath, finalPath);
                await deleteWithRetry(tempPath);
                const url = `${CHATROOM_URL_BASE}/${finalFilename}`;
                imgStmt.run(postId, url, i);
            }
        }
        res.json({ success: true, postId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '发布失败' });
    }
});

router.get('/posts', async (req, res) => {
    try {
        const posts = global.db.prepare(`
            SELECT 
                p.*, 
                u.name as user_name, 
                u.avatar as user_avatar,
                u.badge,
                COALESCE(gc.guard_level, 0) as guard_level,
                COALESCE(gc.medal_level, 0) as medal_level,
                (SELECT COUNT(*) FROM ga_post_like WHERE post_id = p.id) as like_count,
                (SELECT COUNT(*) FROM ga_forward WHERE original_post_id = p.id) as forward_count
            FROM ga_post p
            JOIN user u ON p.user_id = u.id
            LEFT JOIN guard_cache gc ON u.bilibili_uid = gc.uid
            WHERE p.is_deleted = 0
            ORDER BY p.created_at DESC
        `).all();
        let userLikes = {};
        if (req.user && req.user.id) {
            const likes = global.db.prepare('SELECT post_id FROM ga_post_like WHERE user_id = ?').all(req.user.id);
            userLikes = likes.reduce((map, item) => { map[item.post_id] = true; return map; }, {});
        }
        for (const post of posts) {
            const images = global.db.prepare('SELECT image_url FROM ga_post_image WHERE post_id = ? ORDER BY sort_order').all(post.id);
            post.images = images.map(img => img.image_url);
            post.liked = !!userLikes[post.id];
            const comments = global.db.prepare(`
                SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.badge,
                       COALESCE(gc.medal_level, 0) as medal_level,
                       (SELECT COUNT(*) FROM ga_comment_like WHERE comment_id = c.id) as comment_like_count
                FROM ga_comment c
                JOIN user u ON c.user_id = u.id
                LEFT JOIN guard_cache gc ON u.bilibili_uid = gc.uid
                WHERE c.post_id = ? AND c.is_deleted = 0
                ORDER BY c.created_at ASC
            `).all(post.id);
            if (req.user && req.user.id) {
                const commentIds = comments.map(c => c.id);
                if (commentIds.length) {
                    const commentLikes = global.db.prepare(`
                        SELECT comment_id FROM ga_comment_like WHERE user_id = ? AND comment_id IN (${commentIds.join(',')})
                    `).all(req.user.id);
                    const likedCommentIds = new Set(commentLikes.map(l => l.comment_id));
                    for (const comment of comments) comment.comment_liked = likedCommentIds.has(comment.id);
                } else for (const comment of comments) comment.comment_liked = false;
            } else for (const comment of comments) comment.comment_liked = false;
            post.comments = comments;
        }
        res.json(posts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '获取动态失败' });
    }
});

router.delete('/post/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userPerm = req.user.permission;
    const post = global.db.prepare('SELECT user_id FROM ga_post WHERE id = ? AND is_deleted = 0').get(id);
    if (!post) return res.status(404).json({ error: '动态不存在' });
    const isAuthor = post.user_id === userId;
    const isAdmin = userPerm === 1 || userPerm === 2;
    if (!isAuthor && !isAdmin) return res.status(403).json({ error: '无权删除' });
    try {
        const images = global.db.prepare('SELECT image_url FROM ga_post_image WHERE post_id = ?').all(id);
        for (const img of images) await deleteImageFileByUrl(img.image_url);
        global.db.prepare('DELETE FROM ga_post_like WHERE post_id = ?').run(id);
        global.db.prepare('DELETE FROM ga_forward WHERE original_post_id = ? OR forward_post_id = ?').run(id, id);
        const comments = global.db.prepare('SELECT id, image_url FROM ga_comment WHERE post_id = ? AND is_deleted = 0').all(id);
        for (const comment of comments) {
            if (comment.image_url) await deleteImageFileByUrl(comment.image_url);
            global.db.prepare('DELETE FROM ga_comment_like WHERE comment_id = ?').run(comment.id);
        }
        global.db.prepare('DELETE FROM ga_comment WHERE post_id = ?').run(id);
        global.db.prepare('DELETE FROM ga_post WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除失败' });
    }
});

router.post('/post/:id/like', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const now = Math.floor(Date.now() / 1000);
    const existing = global.db.prepare('SELECT id FROM ga_post_like WHERE post_id = ? AND user_id = ?').get(postId, userId);
    if (existing) {
        global.db.prepare('DELETE FROM ga_post_like WHERE post_id = ? AND user_id = ?').run(postId, userId);
        res.json({ success: true, liked: false });
    } else {
        global.db.prepare('INSERT INTO ga_post_like (post_id, user_id, created_at) VALUES (?, ?, ?)').run(postId, userId, now);
        res.json({ success: true, liked: true });
    }
});

router.post('/post/:id/forward', authenticateToken, async (req, res) => {
    const originalPostId = req.params.id;
    const userId = req.user.id;
    const { forwardMessage } = req.body;
    const now = Math.floor(Date.now() / 1000);
    const originalPost = global.db.prepare(`
        SELECT p.content, p.user_id, u.name as user_name 
        FROM ga_post p 
        JOIN user u ON p.user_id = u.id 
        WHERE p.id = ? AND p.is_deleted = 0
    `).get(originalPostId);
    if (!originalPost) return res.status(404).json({ error: '原动态不存在' });
    
    const plainOriginalContent = htmlToPlainText(originalPost.content);
    const safeForwardMessage = forwardMessage ? escapeHtml(forwardMessage.trim()) : '';
    
    let newContent = `转发动态：\n${safeForwardMessage ? safeForwardMessage + '\n' : ''}// @${originalPost.user_name} : ${plainOriginalContent}`;
    if (newContent.length > 5000) newContent = newContent.slice(0, 5000);
    
    try {
        const stmt = global.db.prepare('INSERT INTO ga_post (user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)');
        const info = stmt.run(userId, newContent, now, now);
        const newPostId = info.lastInsertRowid;
        global.db.prepare('INSERT INTO ga_forward (user_id, original_post_id, forward_post_id, created_at) VALUES (?, ?, ?, ?)')
            .run(userId, originalPostId, newPostId, now);
        
        const originalImages = global.db.prepare('SELECT image_url, sort_order FROM ga_post_image WHERE post_id = ?').all(originalPostId);
        if (originalImages.length) {
            const insertImg = global.db.prepare('INSERT INTO ga_post_image (post_id, image_url, sort_order) VALUES (?, ?, ?)');
            for (const img of originalImages) {
                insertImg.run(newPostId, img.image_url, img.sort_order);
            }
        }
        
        res.json({ success: true, postId: newPostId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '转发失败' });
    }
});

router.post('/comment', authenticateToken, upload.single('image'), async (req, res) => {
    const { postId, content } = req.body;
    const userId = req.user.id;
    const userPerm = req.user.permission;
    const now = Math.floor(Date.now() / 1000);
    let cleanContent = content ? sanitizeHtml(content) : '';
    const plainText = cleanContent.replace(/<[^>]*>/g, '').trim();
    const isAdmin = userPerm === 1 || userPerm === 2;
    if ((!plainText && !req.file)) return res.status(400).json({ error: '评论内容或图片不能为空' });
    if (!isAdmin && plainText.length > 1000) return res.status(400).json({ error: '评论内容不能超过1000字' });
    try {
        let imageUrl = null;
        if (req.file) {
            const tempPath = req.file.path;
            const finalDir = `${CHATROOM_BASE}/comments`;
            if (!fsSync.existsSync(finalDir)) fsSync.mkdirSync(finalDir, { recursive: true });
            const finalFilename = path.basename(req.file.filename);
            const finalPath = path.join(finalDir, finalFilename);
            await addWatermark(tempPath, finalPath);
            await deleteWithRetry(tempPath);
            imageUrl = `${CHATROOM_URL_BASE}/comments/${finalFilename}`;
        }
        const stmt = global.db.prepare('INSERT INTO ga_comment (post_id, user_id, content, image_url, created_at) VALUES (?, ?, ?, ?, ?)');
        stmt.run(postId, userId, cleanContent, imageUrl, now);
        const newComment = global.db.prepare(`
            SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.badge,
                   COALESCE(gc.medal_level, 0) as medal_level
            FROM ga_comment c
            JOIN user u ON c.user_id = u.id
            LEFT JOIN guard_cache gc ON u.bilibili_uid = gc.uid
            WHERE c.id = last_insert_rowid()
        `).get();
        newComment.comment_like_count = 0;
        newComment.comment_liked = false;
        res.json({ success: true, comment: newComment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '评论失败' });
    }
});

router.delete('/comment/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userPerm = req.user.permission;
    const comment = global.db.prepare('SELECT user_id, image_url FROM ga_comment WHERE id = ? AND is_deleted = 0').get(id);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    const isAuthor = comment.user_id === userId;
    const isAdmin = userPerm === 1 || userPerm === 2;
    if (!isAuthor && !isAdmin) return res.status(403).json({ error: '无权删除' });
    try {
        if (comment.image_url) await deleteImageFileByUrl(comment.image_url);
        global.db.prepare('DELETE FROM ga_comment_like WHERE comment_id = ?').run(id);
        global.db.prepare('DELETE FROM ga_comment WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '删除失败' });
    }
});

router.post('/comment/:id/like', authenticateToken, async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.id;
    const now = Math.floor(Date.now() / 1000);
    const existing = global.db.prepare('SELECT id FROM ga_comment_like WHERE comment_id = ? AND user_id = ?').get(commentId, userId);
    if (existing) {
        global.db.prepare('DELETE FROM ga_comment_like WHERE comment_id = ? AND user_id = ?').run(commentId, userId);
        res.json({ success: true, liked: false });
    } else {
        global.db.prepare('INSERT INTO ga_comment_like (comment_id, user_id, created_at) VALUES (?, ?, ?)').run(commentId, userId, now);
        res.json({ success: true, liked: true });
    }
});

export default router;
