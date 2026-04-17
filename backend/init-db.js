import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径（与后端 global.db 保持一致）
const dbPath = path.join(__dirname, 'data', 'maruko-sql.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

// ========== 原有表（保持不变） ==========
db.exec(`
CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permission INTEGER NOT NULL DEFAULT 3,   -- 0:海葵王, 1:超级管理员, 2:管理员, 3:普通用户
    is_banned INTEGER NOT NULL DEFAULT 0 CHECK(is_banned IN (0, 1)),
    create_time INTEGER DEFAULT 0,
    update_time INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS photo_album (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    introduction TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    is_review INTEGER NOT NULL DEFAULT 0 CHECK(is_review IN (0, 1, 2)),
    create_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    is_review INTEGER NOT NULL DEFAULT 0 CHECK(is_review IN (0, 1, 2)),
    create_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (album_id) REFERENCES photo_album(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audio_classification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    is_review INTEGER NOT NULL DEFAULT 0 CHECK(is_review IN (0, 1, 2)),
    create_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    classification_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    play_count INTEGER DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    is_review INTEGER NOT NULL DEFAULT 0 CHECK(is_review IN (0, 1, 2)),
    create_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (classification_id) REFERENCES audio_classification(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_duration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    title TEXT,
    create_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER
);

CREATE TABLE IF NOT EXISTS announcement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    author TEXT NOT NULL,
    publish_time INTEGER NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    category TEXT DEFAULT 'system',
    is_deleted INTEGER DEFAULT 0,
    create_time INTEGER,
    update_time INTEGER
);

CREATE TABLE IF NOT EXISTS plan_document (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    upload_time INTEGER NOT NULL,
    uploader_id INTEGER NOT NULL,
    is_current INTEGER DEFAULT 0,
    create_time INTEGER,
    update_time INTEGER,
    FOREIGN KEY (uploader_id) REFERENCES user(id) ON DELETE CASCADE
);
`);

// ========== 新增：B站视频表 ==========
db.exec(`
CREATE TABLE IF NOT EXISTS bilibili_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    bvid TEXT NOT NULL UNIQUE,
    cover_url TEXT,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1 CHECK(status IN (0, 1)),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`);

// ========== 新增：已审核BV表（用于存储通过审核的B站视频BV号） ==========
db.exec(`
CREATE TABLE IF NOT EXISTS audited_bv (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bv TEXT NOT NULL UNIQUE,
    title TEXT,
    cover_url TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`);

// ========== 新增：放映厅表（存储各放映厅推送的视频） ==========
db.exec(`
CREATE TABLE IF NOT EXISTS cinema_halls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hall INTEGER NOT NULL UNIQUE,
    bv TEXT,
    cover TEXT,
    title TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`);

// ========== 打卡表拆分：永久记录表 + 临时心情表 ==========
// 先检查是否存在旧 checkin 表，如果存在则迁移数据
const oldCheckinExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='checkin'").get();
if (oldCheckinExists) {
    console.log('检测到旧 checkin 表，正在迁移数据...');
    // 创建新表
    db.exec(`
        CREATE TABLE IF NOT EXISTS checkin_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            checkin_date TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
            UNIQUE(user_id, checkin_date)
        );
        CREATE TABLE IF NOT EXISTS checkin_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mood TEXT,
            message TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
        );
    `);
    // 迁移数据
    db.prepare(`
        INSERT OR IGNORE INTO checkin_records (user_id, checkin_date, created_at)
        SELECT user_id, checkin_date, created_at FROM checkin
    `).run();
    db.prepare(`
        INSERT INTO checkin_messages (user_id, mood, message, created_at)
        SELECT user_id, mood, message, created_at FROM checkin
    `).run();
    // 删除旧表
    db.exec(`DROP TABLE checkin`);
    console.log('旧 checkin 表数据迁移完成，已删除旧表');
} else {
    // 直接创建新表
    db.exec(`
        CREATE TABLE IF NOT EXISTS checkin_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            checkin_date TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
            UNIQUE(user_id, checkin_date)
        );
        CREATE TABLE IF NOT EXISTS checkin_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mood TEXT,
            message TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
        );
    `);
}

// 索引
db.exec(`
CREATE INDEX IF NOT EXISTS idx_checkin_records_date ON checkin_records(checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkin_messages_created ON checkin_messages(created_at);
`);

// ========== 新增：定时任务日志表 ==========
db.exec(`
CREATE TABLE IF NOT EXISTS cron_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT NOT NULL,
    last_run INTEGER,
    status TEXT
);
`);

// ========== 新增：嘎嘎动态相关表 ==========
db.exec(`
-- 动态主表
CREATE TABLE IF NOT EXISTS ga_post (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 动态图片表
CREATE TABLE IF NOT EXISTS ga_post_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES ga_post(id) ON DELETE CASCADE
);

-- 评论表
CREATE TABLE IF NOT EXISTS ga_comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT,
    image_url TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at INTEGER,
    FOREIGN KEY (post_id) REFERENCES ga_post(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 动态点赞表
CREATE TABLE IF NOT EXISTS ga_post_like (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER,
    UNIQUE(post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES ga_post(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 评论点赞表
CREATE TABLE IF NOT EXISTS ga_comment_like (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at INTEGER,
    UNIQUE(comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES ga_comment(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- 转发记录表
CREATE TABLE IF NOT EXISTS ga_forward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_post_id INTEGER NOT NULL,
    forward_post_id INTEGER NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (original_post_id) REFERENCES ga_post(id) ON DELETE CASCADE,
    FOREIGN KEY (forward_post_id) REFERENCES ga_post(id) ON DELETE CASCADE
);

-- 用户收藏表情表
CREATE TABLE IF NOT EXISTS user_favorite_emojis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    UNIQUE(user_id, image_url)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ga_post_created ON ga_post(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorite_user ON user_favorite_emojis(user_id);
`);

// ========== 为 user 表增加新字段（安全方式） ==========
const columnsToAdd = [
    { name: 'avatar', type: 'TEXT', default: "''" },
    { name: 'bilibili_uid', type: 'TEXT', default: 'NULL' },
    { name: 'bilibili_name', type: 'TEXT', default: "''" },
    { name: 'badge', type: 'TEXT', default: "'未上供'" },
    { name: 'custom_tag', type: 'TEXT', default: "''" },
    { name: 'email', type: 'TEXT', default: 'NULL' },
    { name: 'total_checkins', type: 'INTEGER', default: '0' },
    { name: 'last_avatar_change', type: 'INTEGER', default: '0' },
    { name: 'avatar_last_updated', type: 'INTEGER', default: '0' }
];

for (const col of columnsToAdd) {
    try {
        db.exec(`ALTER TABLE user ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default};`);
        console.log(`已添加 user.${col.name} 字段`);
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            console.error(`添加字段 ${col.name} 失败:`, e.message);
        }
    }
}

// 处理 bilibili_uid 唯一性（清理重复空值，添加唯一索引）
try {
    // 将空字符串或NULL的bilibili_uid统一置为NULL（避免唯一约束冲突）
    db.exec(`UPDATE user SET bilibili_uid = NULL WHERE bilibili_uid = '' OR bilibili_uid = 'NULL'`);
    // 查找重复的bilibili_uid（非NULL）
    const duplicates = db.prepare(`
        SELECT bilibili_uid, COUNT(*) as cnt FROM user 
        WHERE bilibili_uid IS NOT NULL 
        GROUP BY bilibili_uid HAVING cnt > 1
    `).all();
    for (const dup of duplicates) {
        const rows = db.prepare(`SELECT id FROM user WHERE bilibili_uid = ? ORDER BY id ASC`).all(dup.bilibili_uid);
        const keepId = rows[0].id;
        const deleteIds = rows.slice(1).map(r => r.id);
        for (const id of deleteIds) {
            db.prepare(`UPDATE user SET bilibili_uid = NULL WHERE id = ?`).run(id);
            console.log(`已将用户 ${id} 的 bilibili_uid 清空（重复）`);
        }
    }
    // 创建唯一索引（如果不存在）
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_bilibili_uid ON user(bilibili_uid);`);
    console.log('已确保 bilibili_uid 字段唯一性索引');
} catch (e) {
    console.error('设置 bilibili_uid 唯一索引失败:', e.message);
}

// ========== 新增：B站授权账号表（用于存储超级管理员授权的B站Cookie） ==========
db.exec(`
CREATE TABLE IF NOT EXISTS bilibili_account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cookie TEXT NOT NULL,
    update_time INTEGER
);
`);

// ========== 新增：大航海成员缓存表（每周更新一次，增加 medal_level 列） ==========
db.exec(`
CREATE TABLE IF NOT EXISTS guard_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    guard_level INTEGER,
    medal_level INTEGER DEFAULT 0,
    username TEXT,
    update_time INTEGER
);
CREATE INDEX IF NOT EXISTS idx_guard_cache_uid ON guard_cache(uid);
`);

console.log('数据库初始化完成！');
db.close();