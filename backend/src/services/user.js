import { read_json } from '../method/read.js';
import jwt from 'jsonwebtoken';
import {
    hashPassword, verifyPassword, validateEmailFormat,
    generateVerificationCode, getCurrentTimestamp,
    createSuccessResponse, createErrorResponse,
    validateStringLength, validateRequired, validateEnum, validateId,
    PERMISSIONS, getUserInfo, isUserBanned
} from '../method/business-utils.js';
import { queryOne, queryAll, insert, update, exists } from '../method/database.js';
import { getBilibiliUserInfo, getBilibiliMedal } from './bilibiliUser.js';
import { autoSyncOnLogin, getUserAvatar } from '../services/avatarService.js';

// 扩展权限常量（确保包含海葵王）
if (!PERMISSIONS.HAIKUIWANG) {
    PERMISSIONS.HAIKUIWANG = 0;
}
if (!PERMISSIONS.SUPER_ADMIN) {
    PERMISSIONS.SUPER_ADMIN = 1;
}
if (!PERMISSIONS.ADMIN) {
    PERMISSIONS.ADMIN = 2;
}
if (!PERMISSIONS.USER) {
    PERMISSIONS.USER = 3;
}

/**
 * 密码强度校验：8-12位，必须包含数字、字母、特殊符号
 */
function isStrongPassword(password) {
    const regex = /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,12}$/;
    return regex.test(password);
}

/**
 * 发送验证码服务
 */
export async function sendVerificationCode(email, emailTransporter, appConfig) {
    if (!validateEmailFormat(email)) {
        return createErrorResponse('请提供有效的邮箱地址', 400);
    }

    const verificationCode = generateVerificationCode(6);
    const redisKey = `verification_code:${email}`;
    await global.redis.setex(redisKey, 300, verificationCode);

    const mailOptions = {
        from: appConfig.email.from,
        to: email,
        subject: appConfig.email.subject || '默认标题',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>您好！</p>
                <p>您的验证码是：<strong style="font-size: 24px; color: #007bff;">${verificationCode}</strong></p>
                <p>验证码将在3分钟后过期，请及时使用。</p>
                <p>如果这不是您的操作，请忽略此邮件。</p>
                <hr>
                <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
            </div>
        `
    };

    await emailTransporter.sendMail(mailOptions);
    logger.info(`验证码已发送到邮箱: ${email}`);
    return createSuccessResponse('验证码已发送到您的邮箱');
}

/**
 * 验证验证码
 */
export async function verifyCode(email, code) {
    const emailValidation = validateRequired(email, '邮箱');
    if (!emailValidation.valid) return createErrorResponse(emailValidation.message, 400);
    const codeValidation = validateRequired(code, '验证码');
    if (!codeValidation.valid) return createErrorResponse(codeValidation.message, 400);

    const redisKey = `verification_code:${email}`;
    const storedCode = await global.redis.get(redisKey);
    if (!storedCode) return createErrorResponse('验证码已过期或不存在', 400);
    if (storedCode !== code) return createErrorResponse('验证码错误', 400);

    logger.info(`邮箱 ${email} 验证码验证成功`);
    return createSuccessResponse('验证码验证成功');
}

/**
 * 用户登录服务 - 支持 B站UID 或 邮箱登录
 * 返回 id 字段供前端权限判断使用
 */
export async function login(accountNumber, password, token) {
    const config = read_json('configs', 'config');
    const jwtSecret = config.token;

    if (token) {
        try {
            const decoded = jwt.verify(token, jwtSecret);
            const user = getUserInfo(decoded.userId);
            if (!user) return createErrorResponse('用户不存在', 401);
            if (isUserBanned(decoded.userId)) return createErrorResponse('账号已被封禁', 403);
            const newToken = jwt.sign(
                { userId: user.id, accountNumber: decoded.accountNumber },
                jwtSecret,
                { expiresIn: '3d' }
            );
            return createSuccessResponse('登录成功', {
                token: newToken,
                id: user.id,
                permission: Number(user.permission),
                name: user.name
            });
        } catch (error) {
            return createErrorResponse('token无效或已过期', 401);
        }
    }

    const accountValidation = validateRequired(accountNumber, '账号');
    if (!accountValidation.valid) return createErrorResponse(accountValidation.message, 400);
    const passwordValidation = validateRequired(password, '密码');
    if (!passwordValidation.valid) return createErrorResponse(passwordValidation.message, 400);

    try {
        const user = queryOne(
            `SELECT * FROM user WHERE account_number = ? OR email = ? OR bilibili_uid = ?`,
            [accountNumber, accountNumber, accountNumber]
        );
        if (!user) return createErrorResponse('账号或密码错误', 401);
        if (isUserBanned(user.id)) return createErrorResponse('账号已被封禁', 403);
        const isPasswordValid = await verifyPassword(password, user.password);
        if (!isPasswordValid) return createErrorResponse('账号或密码错误', 401);

        const token = jwt.sign(
            { userId: user.id, accountNumber: user.account_number },
            jwtSecret,
            { expiresIn: '3d' }
        );

        // 登录时自动同步本地头像
        if (user.bilibili_uid) {
            autoSyncOnLogin(user.id, user.bilibili_uid).catch(err => {
                logger.warn(`登录头像同步异常: userId=${user.id}`);
            });
        }

        // 获取本地头像路径
        const localAvatar = getUserAvatar(user.id);

        logger.info(`用户登录成功: ${user.name} (${accountNumber})`);
        return createSuccessResponse('登录成功', {
            token: token,
            id: user.id,
            permission: Number(user.permission),
            name: user.name,
            avatar: localAvatar || '',
            bilibili_uid: user.bilibili_uid || null
        });
    } catch (error) {
        logger.error('登录失败:', error);
        return createErrorResponse('登录失败，请稍后重试', 500);
    }
}

/**
 * 用户注册服务
 */
export async function register(bilibiliUid, email, password, verificationCode) {
    if (!bilibiliUid) return createErrorResponse('B站UID不能为空', 400);
    if (!email) return createErrorResponse('邮箱不能为空', 400);
    if (!password) return createErrorResponse('密码不能为空', 400);
    if (!verificationCode) return createErrorResponse('验证码不能为空', 400);
    if (!validateEmailFormat(email)) return createErrorResponse('请提供有效的邮箱地址', 400);
    if (!isStrongPassword(password)) {
        return createErrorResponse('密码必须为8-12位，包含数字、字母和特殊符号', 400);
    }

    const codeResult = await verifyCode(email, verificationCode);
    if (!codeResult.success) return createErrorResponse('验证码错误或已过期', 400);

    try {
        const emailExists = queryOne(`SELECT id FROM user WHERE account_number = ? OR email = ?`, [email, email]);
        if (emailExists) return createErrorResponse('该邮箱已被注册', 400);
        const uidExists = queryOne(`SELECT id FROM user WHERE bilibili_uid = ?`, [bilibiliUid]);
        if (uidExists) return createErrorResponse('该B站UID已被注册', 400);

        const biliInfo = await getBilibiliUserInfo(bilibiliUid);
        if (!biliInfo) return createErrorResponse('B站UID无效或无法获取用户信息', 400);

        let badge = '未上供';
        try {
            badge = await getBilibiliMedal(bilibiliUid);
        } catch (err) {
            logger.warn(`首次获取大航海身份失败: uid=${bilibiliUid}, 错误=${err.message}`);
        }

        const hashedPassword = await hashPassword(password);
        const now = getCurrentTimestamp();
        const result = insert(
            `INSERT INTO user (
                name, account_number, password, email, bilibili_uid, bilibili_name,
                avatar, avatar_last_updated, badge, permission, is_banned, create_time, update_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                biliInfo.name,
                email,
                hashedPassword,
                email,
                bilibiliUid,
                biliInfo.name,
                '',
                now,
                badge,
                PERMISSIONS.USER,
                0,
                now,
                now
            ]
        );
        const userId = result.lastInsertRowid;

        // 注册后立即同步本地头像
        if (bilibiliUid) {
            const { syncUserAvatar } = await import('../services/avatarService.js');
            const avatarResult = await syncUserAvatar(userId, bilibiliUid, true);
            if (avatarResult.success && avatarResult.data?.avatar) {
                update('UPDATE user SET avatar = ? WHERE id = ?', [avatarResult.data.avatar, userId]);
            }
        }

        setImmediate(async () => {
            try {
                const freshBadge = await getBilibiliMedal(bilibiliUid);
                if (freshBadge !== badge) {
                    global.db.prepare('UPDATE user SET badge = ? WHERE id = ?').run(freshBadge, userId);
                    logger.info(`用户 ${userId} 的 badge 已更新: ${badge} -> ${freshBadge}`);
                }
            } catch (err) {
                logger.error(`后台更新用户 ${userId} 的 badge 失败:`, err.message);
            }
        });

        logger.info(`新用户注册成功: ${biliInfo.name} (B站UID: ${bilibiliUid}, 邮箱: ${email})`);
        return createSuccessResponse('注册成功', { userId });
    } catch (error) {
        logger.error('注册失败:', error);
        return createErrorResponse('注册失败，请稍后重试', 500);
    }
}

/**
 * 生成随机密码
 */
function generateRandomPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * 获取所有用户列表 - 海葵王或超级管理员专用
 */
export async function getUsers() {
    try {
        const users = queryAll(`
            SELECT
                id, name, account_number, email, bilibili_uid, bilibili_name,
                badge, custom_tag, avatar, permission, is_banned, create_time
            FROM user
            ORDER BY create_time DESC
        `);
        for (const user of users) {
            user.permission = Number(user.permission);
        }
        logger.info(`获取用户列表: ${users.length}个用户`);
        return createSuccessResponse('获取用户列表成功', users);
    } catch (error) {
        logger.error('获取用户列表失败:', error);
        return createErrorResponse('获取用户列表失败', 500);
    }
}

/**
 * 封禁/解封用户 - 海葵王或超级管理员专用
 */
export async function banUser(userId, isBanned, adminId) {
    try {
        const idValidation = validateId(userId, '用户ID');
        if (!idValidation.valid) return createErrorResponse(idValidation.message, 400);
        const user = getUserInfo(userId);
        if (!user) return createErrorResponse('用户不存在', 404);
        if (userId === adminId) return createErrorResponse('不能对自己进行封禁操作', 400);
        const banValidation = validateEnum(isBanned, [0, 1], 'is_banned');
        if (!banValidation.valid) return createErrorResponse(banValidation.message, 400);

        update(`UPDATE user SET is_banned = ?, update_time = ? WHERE id = ?`, [isBanned, getCurrentTimestamp(), userId]);
        const action = isBanned ? '封禁' : '解封';
        logger.info(`${action}用户成功: ${user.name}(${userId}) by admin ${adminId}`);
        return createSuccessResponse(`${action}用户成功`, { userId, isBanned });
    } catch (error) {
        logger.error('封禁/解封用户失败:', error);
        return { success: false, message: '操作失败', code: 500 };
    }
}

/**
 * 修改用户权限 - 海葵王或超级管理员专用
 */
export async function updateUserPermission(userId, permission, adminId) {
    try {
        const idValidation = validateId(userId, '用户ID');
        if (!idValidation.valid) return createErrorResponse(idValidation.message, 400);
        const user = getUserInfo(userId);
        if (!user) return createErrorResponse('用户不存在', 404);
        const permissionValidation = validateEnum(permission, [0, 1, 2, 3]);
        if (!permissionValidation.valid) return createErrorResponse('无效的权限级别', 400);
        if (userId === adminId) return { success: false, message: '不能修改自己的权限', code: 400 };

        const currentTime = getCurrentTimestamp();
        update(`UPDATE user SET permission = ?, update_time = ? WHERE id = ?`, [permission, currentTime, userId]);
        logger.info(`修改用户权限成功: ${user.name}(${userId}) 权限从 ${user.permission} 改为 ${permission} by admin ${adminId}`);
        return { success: true, message: '修改用户权限成功', data: { userId, permission } };
    } catch (error) {
        logger.error('修改用户权限失败:', error);
        return { success: false, message: '操作失败', code: 500 };
    }
}

/**
 * 重置用户密码 - 海葵王或超级管理员专用
 */
export async function resetUserPassword(userId, adminId) {
    try {
        const user = queryOne('SELECT id, name, email FROM user WHERE id = ?', [userId]);
        if (!user) return { success: false, message: '用户不存在', code: 404 };
        const newPassword = generateRandomPassword(8);
        const hashedPassword = await hashPassword(newPassword);
        const currentTime = getCurrentTimestamp();
        update(`UPDATE user SET password = ?, update_time = ? WHERE id = ?`, [hashedPassword, currentTime, userId]);

        try {
            const config = read_json('configs', 'config');
            const emailTransporter = global.emailTransporter;
            const mailOptions = {
                from: config.email.from,
                to: user.email,
                subject: 'MarukoNode 密码重置通知',
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">MarukoNode 密码重置通知</h2>
                        <p>您好，${user.name}！</p>
                        <p>您的密码已被管理员重置，新密码是：<strong style="font-size: 24px; color: #007bff;">${newPassword}</strong></p>
                        <p>请及时登录并修改密码。</p>
                        <p>如果这不是您的操作，请立即联系管理员。</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
                    </div>`
            };
            await emailTransporter.sendMail(mailOptions);
            logger.info(`密码重置邮件已发送到: ${user.email}`);
        } catch (emailError) {
            logger.error('发送密码重置邮件失败:', emailError);
        }

        logger.info(`重置用户密码成功: ${user.name}(${userId}) by admin ${adminId}`);
        return { success: true, message: '重置用户密码成功，新密码已发送到用户邮箱', data: { userId } };
    } catch (error) {
        logger.error('重置用户密码失败:', error);
        return { success: false, message: '重置密码失败', code: 500 };
    }
}

/**
 * 删除用户 - 海葵王或超级管理员专用（彻底删除）
 */
export async function deleteUser(userId, adminId) {
    try {
        const user = queryOne('SELECT id, name FROM user WHERE id = ?', [userId]);
        if (!user) return { success: false, message: '用户不存在', code: 404 };
        if (userId === adminId) return { success: false, message: '不能删除自己的账号', code: 400 };

        const db = global.db;
        db.exec('BEGIN TRANSACTION');
        try {
            db.prepare('DELETE FROM audio WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM audio_classification WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM photo_album WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM photo WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM checkin_records WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM checkin_messages WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM ga_post WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM ga_comment WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM user_favorite_emojis WHERE user_id = ?').run(userId);
            db.prepare('DELETE FROM user WHERE id = ?').run(userId);
            db.exec('COMMIT');
            logger.info(`彻底删除用户成功: ${user.name}(${userId}) by admin ${adminId}`);
            return { success: true, message: '删除用户成功', data: { userId } };
        } catch (transactionError) {
            db.exec('ROLLBACK');
            throw transactionError;
        }
    } catch (error) {
        logger.error('删除用户失败:', error);
        return { success: false, message: '删除用户失败', code: 500 };
    }
}

/**
 * 从B站同步用户头像（无时间限制，不更新 avatar_last_updated）
 */
export async function updateAvatar(userId, bilibiliUid) {
    if (!userId || !bilibiliUid) {
        return createErrorResponse('用户ID和B站UID不能为空', 400);
    }

    const user = queryOne('SELECT id FROM user WHERE id = ?', [userId]);
    if (!user) return createErrorResponse('用户不存在', 404);

    try {
        const biliInfo = await getBilibiliUserInfo(bilibiliUid);
        if (!biliInfo || !biliInfo.avatar) {
            return createErrorResponse('无法获取B站用户头像，请检查UID是否正确', 400);
        }

        update(
            `UPDATE user SET avatar = ?, update_time = ? WHERE id = ?`,
            [biliInfo.avatar, getCurrentTimestamp(), userId]
        );
        logger.info(`用户 ${userId} 通过 B站 UID ${bilibiliUid} 同步了头像`);
        return createSuccessResponse('头像同步成功', { avatar: biliInfo.avatar });
    } catch (error) {
        logger.error('同步B站头像失败:', error);
        return createErrorResponse('同步失败，请稍后重试', 500);
    }
}