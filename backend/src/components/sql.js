import Database from 'better-sqlite3';
import path from "path";

export default () => {
    const dbPath = path.join(path.resolve(), "data", "maruko-sql.db");
    const db = new Database(dbPath, {
        readonly: false,
        fileMustExist: false,
        foreign_keys: true // better-sqlite3特有配置
    });
    
    // 使用DELETE模式替代WAL模式，避免生成.db-wal和.db-shm文件
    db.pragma('journal_mode = DELETE');
    
    global.db = db;
    logger.info(chalk.white('数据库连接成功: ' + chalk.blue(dbPath)))
    
    // 自动迁移：确保视频相关表包含title字段
    runDatabaseMigrations(db);
}

/**
 * 运行数据库迁移脚本，确保表结构是最新的
 */
function runDatabaseMigrations(db) {
    const migrations = [
        {
            name: 'video_submissions.title',
            check: () => {
                const columns = db.pragma("table_info('video_submissions')");
                return columns.some(col => col.name === 'title');
            },
            run: () => {
                db.exec(`ALTER TABLE video_submissions ADD COLUMN title TEXT;`);
                logger.info('已添加 video_submissions.title 字段');
            }
        },
        {
            name: 'user.badge',
            check: () => {
                const columns = db.pragma("table_info('user')");
                return columns.some(col => col.name === 'badge');
            },
            run: () => {
                db.exec(`ALTER TABLE user ADD COLUMN badge TEXT DEFAULT '未上供';`);
                logger.info('已添加 user.badge 字段');
            }
        },
        {
            name: 'user.medal_level',
            check: () => {
                const columns = db.pragma("table_info('user')");
                return columns.some(col => col.name === 'medal_level');
            },
            run: () => {
                db.exec(`ALTER TABLE user ADD COLUMN medal_level INTEGER DEFAULT 0;`);
                logger.info('已添加 user.medal_level 字段');
            }
        },
        {
            name: 'user.bilibili_uid',
            check: () => {
                const columns = db.pragma("table_info('user')");
                return columns.some(col => col.name === 'bilibili_uid');
            },
            run: () => {
                db.exec(`ALTER TABLE user ADD COLUMN bilibili_uid TEXT;`);
                logger.info('已添加 user.bilibili_uid 字段');
            }
        },
        {
            name: 'user.custom_tag',
            check: () => {
                const columns = db.pragma("table_info('user')");
                return columns.some(col => col.name === 'custom_tag');
            },
            run: () => {
                db.exec(`ALTER TABLE user ADD COLUMN custom_tag TEXT;`);
                logger.info('已添加 user.custom_tag 字段');
            }
        },
        {
            name: 'guard_cache',
            check: () => {
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guard_cache'").all();
                return tables.length > 0;
            },
            run: () => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS guard_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        uid TEXT NOT NULL,
                        uname TEXT,
                        face TEXT,
                        guard_level INTEGER DEFAULT 0,
                        medal_level INTEGER DEFAULT 0,
                        created_at INTEGER DEFAULT (strftime('%s', 'now'))
                    );
                `);
                logger.info('已创建 guard_cache 表');
            }
        },
        {
            name: 'plan_document.is_review',
            check: () => {
                const columns = db.pragma("table_info('plan_document')");
                return columns.some(col => col.name === 'is_review');
            },
            run: () => {
                db.exec(`ALTER TABLE plan_document ADD COLUMN is_review INTEGER DEFAULT 0;`);
                logger.info('已添加 plan_document.is_review 字段');
            }
        },
        {
            name: 'cinema_halls',
            check: () => {
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cinema_halls'").all();
                return tables.length > 0;
            },
            run: () => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS cinema_halls (
                        hall INTEGER PRIMARY KEY,
                        bv TEXT,
                        cover TEXT,
                        title TEXT,
                        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                    );
                `);
                // 初始化4个放映厅记录
                db.exec(`
                    INSERT OR IGNORE INTO cinema_halls (hall, bv, cover, title, updated_at) VALUES (1, NULL, NULL, NULL, 0);
                    INSERT OR IGNORE INTO cinema_halls (hall, bv, cover, title, updated_at) VALUES (2, NULL, NULL, NULL, 0);
                    INSERT OR IGNORE INTO cinema_halls (hall, bv, cover, title, updated_at) VALUES (3, NULL, NULL, NULL, 0);
                    INSERT OR IGNORE INTO cinema_halls (hall, bv, cover, title, updated_at) VALUES (4, NULL, NULL, NULL, 0);
                `);
                logger.info('已创建 cinema_halls 表');
            }
        },
        {
            name: 'guard_cache_stats',
            check: () => {
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guard_cache_stats'").all();
                return tables.length > 0;
            },
            run: () => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS guard_cache_stats (
                        id INTEGER PRIMARY KEY DEFAULT 1,
                        total_count INTEGER DEFAULT 0,
                        api_total_count INTEGER DEFAULT 0,
                        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                    );
                `);
                db.exec(`INSERT OR IGNORE INTO guard_cache_stats (id, total_count, api_total_count) VALUES (1, 0, 0);`);
                logger.info('已创建 guard_cache_stats 表');
            }
        },
        {
            name: 'user.avatar_last_updated',
            check: () => {
                const columns = db.pragma("table_info('user')");
                return columns.some(col => col.name === 'avatar_last_updated');
            },
            run: () => {
                db.exec(`ALTER TABLE user ADD COLUMN avatar_last_updated INTEGER DEFAULT 0;`);
                logger.info('已添加 user.avatar_last_updated 字段');
            }
        }
    ];

    for (const migration of migrations) {
        try {
            if (!migration.check()) {
                migration.run();
            } else {
                logger.debug(`数据库字段 ${migration.name} 已存在，跳过迁移`);
            }
        } catch (e) {
            if (!e.message.includes('duplicate column name') && !e.message.includes('already exists')) {
                logger.error(`数据库迁移失败 [${migration.name}]:`, e.message);
            } else {
                logger.debug(`数据库字段 ${migration.name} 已存在（捕获异常）`);
            }
        }
    }
}