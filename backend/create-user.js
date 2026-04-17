import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getBilibiliUserInfo, getBilibiliMedal } from './src/services/bilibiliUser.js';

const db = new Database('./data/maruko-sql.db');
global.db = db;

// 命令行参数：node create-user.js <名字> <邮箱> <密码> <权限> <bilibili_uid>
const nameArg = process.argv[2] || null;
const email = process.argv[3] || null;
const password = process.argv[4] || null;
// 修正：当传入0时正确解析，避免0被默认值3覆盖
let permission = 3;
if (process.argv[5] !== undefined) {
    const parsed = parseInt(process.argv[5]);
    if (!isNaN(parsed)) permission = parsed;
}
const bilibiliUid = process.argv[6] || null;

// 参数校验
if (!nameArg || !email || !password) {
    console.error('用法: node create-user.js <名字> <邮箱> <密码> <权限> <bilibili_uid>');
    console.error('示例: node create-user.js "李四2" "4@qq.com" "12345678a+" 2 "511928947"');
    process.exit(1);
}
if (!bilibiliUid) {
    console.error('错误: 必须提供 B站UID (第6个参数)');
    process.exit(1);
}
// 校验 B站UID 格式（纯数字，1-16位）
if (!/^\d{1,16}$/.test(bilibiliUid)) {
    console.error('错误: B站UID 必须为纯数字，且长度不超过16位');
    process.exit(1);
}
if (![0, 1, 2, 3].includes(permission)) {
    console.error('权限必须是 0(海葵王)、1(超级管理员)、2(管理员)、3(普通用户)');
    process.exit(1);
}

// 密码强度校验
function isStrongPassword(pwd) {
    const regex = /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,12}$/;
    return regex.test(pwd);
}
if (!isStrongPassword(password)) {
    console.error('密码必须为8-12位，包含数字、字母和特殊符号');
    process.exit(1);
}

// 检查邮箱是否已被注册
const existing = db.prepare('SELECT id FROM user WHERE account_number = ? OR email = ?').get(email, email);
if (existing) {
    console.error(`错误: 邮箱 ${email} 已被注册`);
    db.close();
    process.exit(1);
}

// 检查 B站UID 是否已被注册
const uidExists = db.prepare('SELECT id FROM user WHERE bilibili_uid = ?').get(bilibiliUid);
if (uidExists) {
    console.error(`错误: B站UID ${bilibiliUid} 已被注册`);
    db.close();
    process.exit(1);
}

// 获取B站用户信息
console.log(`正在获取B站用户信息 (UID: ${bilibiliUid})...`);
const biliInfo = await getBilibiliUserInfo(bilibiliUid);
let finalName = nameArg;
let avatar = '';
if (biliInfo) {
    finalName = biliInfo.name;
    avatar = biliInfo.avatar || '';
    console.log(`B站昵称: ${finalName}`);
} else {
    console.warn('警告: 无法获取B站用户信息，将使用命令行输入的名字');
}

// 获取大航海身份（从缓存读取）
console.log(`正在获取大航海身份 (UID: ${bilibiliUid})...`);
let badge = '未上供';
try {
    badge = await getBilibiliMedal(bilibiliUid);
    console.log(`大航海身份: ${badge}`);
} catch (err) {
    console.error('获取大航海身份失败，将使用默认值', err.message);
}

// 密码加密
const hashedPassword = bcrypt.hashSync(password, 10);
const now = Math.floor(Date.now() / 1000);

// 插入用户
const stmt = db.prepare(`
    INSERT INTO user (
        name, account_number, password, email, bilibili_uid, bilibili_name,
        avatar, badge, custom_tag, permission, is_banned, create_time, update_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const result = stmt.run(
    finalName,
    email,
    hashedPassword,
    email,
    bilibiliUid,
    finalName,
    avatar,
    badge,
    '',
    permission,
    0,
    now,
    now
);

// 权限显示映射
let permissionText = '';
if (permission === 0) permissionText = '海葵王';
else if (permission === 1) permissionText = '超级管理员';
else if (permission === 2) permissionText = '管理员';
else permissionText = '普通用户';

console.log(`✅ 用户创建成功! ID: ${result.lastInsertRowid}`);
console.log(`   名称: ${finalName}`);
console.log(`   邮箱: ${email}`);
console.log(`   B站UID: ${bilibiliUid}`);
console.log(`   大航海身份: ${badge}`);
console.log(`   权限: ${permissionText}`);

db.close();