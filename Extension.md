# WIKI 自定义修改指南

本文档包含 WIKI 项目的所有自定义配置修改项，包括前端配置、后端配置、图片资源修改等。

> 本项目基于 [maruko-wiki](https://github.com/xiaofei114/maruko-wiki) / [maruko-wiki(Gitee)](https://gitee.com/xiaofeiawa/maruko-wiki) 修改而来，已获得原作者授权。

***

## 目录

1. [环境配置](#1-环境配置)
2. [前端自定义修改](#2-前端自定义修改)
3. [后端配置](#3-后端配置)
4. [图片资源修改](#4-图片资源修改)
5. [文本内容修改](#5-文本内容修改)
6. [主题颜色修改](#6-主题颜色修改)
7. [部署配置](#7-部署配置)
8. [新增功能说明](#8-新增功能说明)

***

## 1. 环境配置

### 1.1 前端环境配置

**文件位置**: `frontend/.env.development` (开发环境) / `frontend/.env.production` (生产环境)

```bash
# 开发环境配置 (frontend/.env.development)
VITE_APP_BASE_URL=http://localhost:6660  # 后端API地址
VITE_APP_ROOM_ID=1809236885               # Bilibili房间号
VITE_APP_USER_ID=3546585537448033         # Bilibili用户ID

# 生产环境配置 (frontend/.env.production)
# 方式一：使用nginx代理（推荐）
VITE_APP_BASE_URL=/api

# 方式二：直接连接后端
VITE_APP_BASE_URL=http://你的域名:6660
```

### 1.2 后端配置

**文件位置**: `backend/configs/config.yaml`

```yaml
httpPort: 6660                    # 后端服务端口

# 跨域白名单配置
domainName:
  - http://localhost:6660         # 本地后端
  - http://localhost:5173         # 本地开发前端
  - http://localhost:4173        # 本地预览前端
  - http://daidai.test:8080     # 本地测试域名
  - https://daidai.test:8080     # HTTPS测试域名

token: maruko                     # JWT签名密钥

# 日志配置
log:
  cmd: info                      # 命令行日志级别: debug, info, warn, error
  file: all                      # 文件日志级别: all, debug, info, warn, error

# Redis配置
redis:
  host: localhost
  port: 6379
  password: null                 # 如有密码请填写

# 邮件配置
email:
  # 见邮件配置章节
```

***

## 2. 前端自定义修改

### 2.1 主播信息修改

**文件位置**: `frontend/src/views/Home.vue`

| 修改项     | 行号 | 代码位置                             | 说明        |
| ------- | -- | -------------------------------- | --------- |
| 主播名字    | 11 | `const anchorName = ref('主播名字')` | 修改为主播名字   |
| 默认头像URL | 12 | `const defaultAvatar = ref('')`  | 留空则显示加载动画 |

### 2.2 页面标题和名称

**文件位置**: `frontend/src/components/Top.vue`

| 修改项    | 行号  | 代码位置                                        |
| ------ | --- | ------------------------------------------- |
| 顶部导航标题 | 260 | `<span class="brand-text">主播名字-WIKI</span>` |
| 登录页标题  | 321 | `<h3>主播名字-WIKI</h3>`                        |

**文件位置**: `frontend/src/views/Home.vue`

| 修改项     | 行号  | 代码位置                          | 默认值         |
| ------- | --- | ----------------------------- | ----------- |
| 粉丝数量标题  | 596 | `'呆呆今天10w粉了吗？'` / `'呆呆今天多少粉'` | 根据粉丝数显示不同文案 |
| 1w粉达成文案 | 603 | `'恭喜呆呆1w粉达成！距离10w粉还差 ...'`    | 1万粉庆祝文案     |
| 距离1w粉文案 | 606 | `'距离1w粉还差 ...'`               | 1万粉目标文案     |

### 2.3 直播数据配置

**文件位置**: `frontend/src/views/Home.vue`

| 修改项      | 行号  | 默认值  | 说明         |
| -------- | --- | ---- | ---------- |
| 月度直播时长目标 | 657 | `90` | 每月直播90小时目标 |
| 有效天数目标   | 22  | `22` | 每月22天有效直播  |

```javascript
// 修改月度时长目标 (行657)
<template #suffix>小时/90小时</template>

// 修改有效天目标 (Home.vue 第22行)
const ct = 22  // 有效天目标
```

### 2.4 首页模块标题

**文件位置**: `frontend/src/views/Home.vue`

| 模块    | 行号     | 默认值    |
| ----- | ------ | ------ |
| 相册模块  | ~1529 | `呆呆相册` |
| 音声模块  | ~1530 | `呆呆音声` |
| 公告模块  | ~1531 | `公告中心` |
| 企划表模块 | ~1532 | `企划表`  |

### 2.5 底部链接修改

**文件位置**: `frontend/src/components/Bottom.vue`

| 修改项 | 行号 | 说明 |
| ------ | --- | ---- |
| Gitee链接 | 6 | 修改为新的 Gitee 仓库地址 |
| GitHub链接 | 7 | 修改为新的 GitHub 仓库地址 |
| 爱发电链接 | - | 修改为爱发电主页地址 |
| 品牌名称 | 22 | 修改 `黛棠OI-WIKI` 为你的名称 |
| 备案号 | 39 | 修改为你的实际备案号 |

***

## 3. 后端配置

### 3.1 服务端口

**文件位置**: `backend/configs/config.yaml`

```yaml
httpPort: 6660
```

### 3.2 CORS跨域配置

**文件位置**: `backend/configs/config.yaml`

```yaml
domainName:
  - http://localhost:6660
  - http://localhost:5173
  - http://localhost:4173
  - http://你的域名:端口
  - https://你的域名
```

### 3.3 数据库自动建表

**文件位置**: `backend/src/components/sql.js`

后端启动时自动创建以下表：

| 表名                    | 说明    |
| --------------------- | ----- |
| user                  | 用户表   |
| photo\_album          | 相册分类表 |
| photo                 | 照片表   |
| audio\_classification | 音声分类表 |
| audio                 | 音声表   |
| live\_duration        | 直播记录表 |
| announcement          | 公告表   |
| plan\_document        | 企划文档表 |
| checkin               | 签到表   |
| danmaku               | 弹幕表   |
| comment               | 评论表   |
| emoji                 | 收藏表情表 |
| ema                   | 绘马表   |
| norito                | 祝词表   |
| video\_submissions    | 视频投稿表 |
| audited\_bv           | 已审核BV表 |
| guard\_cache          | 大航海缓存表 |

***

## 4. 图片资源修改

### 4.1 用户头像

**文件位置**: `frontend/src/components/Top.vue`

```javascript
// 第7行 - 取消注释并修改为你的图片
import img from '@/assets/用户.jpg'
```

**放置图片**: `frontend/src/assets/用户.jpg`

### 4.2 背景图片

首页背景图在 `frontend/src/views/Home.vue` 中定义：

```css
/* 行1536-1540 */
background-image:
    url('https://i0.hdslb.com/bfs/new_dyn/70/3546585537448033/20250406/18/1a288f6e4a5a6f1e9d9c0e4c7b3a5c6.jpg@.webp'),
    linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
```

如需修改，替换URL即可。

### 4.3 用户头像来源（已修改）

TOP页右上角头像已改为使用后端存储的用户头像，通过 `/api/images/avatar/${bilibili_uid}.jpg` 获取。用户需重新登录才能生效。

***

## 5. 文本内容修改

### 5.1 首页文本

**文件位置**: `frontend/src/views/Home.vue`

| 文本内容   | 行号范围       | 说明           |
| ------ | ---------- | ------------ |
| 主播名字   | 11         | `anchorName` |
| 粉丝文案   | 596-606    | 根据粉丝数显示不同文案  |
| 直播时长目标 | 657        | 90小时目标       |
| 模块标题   | 1529-1532  | 相册、音声、公告、企划表 |
| 模块描述   | 约1533-1536 | 各模块的描述文字     |

### 5.2 Bilibili链接

**文件位置**: `frontend/src/views/Home.vue`

| 链接   | 行号  | 默认值                                           |
| ---- | --- | --------------------------------------------- |
| 主播主页 | 568 | `https://space.bilibili.com/3546585537448033` |
| 直播间  | 770 | `https://live.bilibili.com/1809236885`        |

### 5.3 第三方链接

**文件位置**: `frontend/src/components/Bottom.vue`

| 链接   | 行号 | 当前值 |
| ---- | --- | ---- |
| Gitee | 6 | `https://gitee.com/jing-xiao/oi-wiki/` |
| GitHub | 7 | `https://github.com/Tkingxiao/oi-wiki/` |
| 爱发电 | - | `https://afdian.com/a/xiaofeiqwq/` |

***

## 6. 主题颜色修改

### 6.1 主色调

项目主色调为粉色系 `#FF85A2`，如需修改全局色调，需要修改以下位置：

**常用颜色位置** (直接在CSS中搜索 `#FF85A2`):

```css
/* Home.vue */
color: #FF85A2;              /* 各种文字颜色 */
background: #FF85A2;         /* 背景色 */
border-color: #FF85A2;       /* 边框色 */

/* Audio.vue */
color: #FF85A2;              /* 音声页面主题色 */

/* PlanDocument.vue */
color: #FF85A2;              /* 企划表页面主题色 */

/* PhotoAlbumDetail.vue */
color: #FF85A2;              /* 相册详情页主题色 */
```

### 6.2 Element Plus 主题色

如果需要修改Element Plus组件的主题色，需要在 `frontend/src/main.js` 中添加自定义主题配置，或使用CSS覆盖。

***

## 7. 部署配置

### 7.1 Nginx配置示例

**文件位置**: 项目根目录 `nginx.conf`

```nginx
# 主服务器配置
server {
    listen 80;
    server_name daidai.test;

    # 文件上传大小限制
    client_max_body_size 100M;

    root C:/data/web/maruko-wiki/frontend/dist;
    #dist地址 选择你的地址
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:6660/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(?:js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

### 7.2 启动命令

```bash
# 后端启动
cd backend
pnpm install
pnpm start

# 前端构建
cd frontend
pnpm install
pnpm build

# 前端开发模式
cd frontend
pnpm dev

# 前端预览
cd frontend
pnpm build
pnpm preview

#完整启动
#终端一
cd frontend
pnpm install
pnpm build

#终端二
cd backend
pnpm install
pnpm start
```

### 7.3 文件存储路径

ChatRoom 相关图片已迁移至 `data/document/images/ChatRoom/` 目录统一管理（包含普通图片、收藏表情、绘马图片、评论图片）。旧路径 `/uploads/chatRoom` 会自动 301 重定向到新路径。

***

## 8. 新增功能说明

### 8.1 ChatRoom 社区聊天室

**路由**: `/chatRoom`

- 实时弹幕显示与发送
- 评论系统（支持表情插入）
- 收藏表情功能
- 绘马许愿系统
- 祝词音频系统
- 图片上传与展示

### 8.2 节目大全（结缘之间）

**路由**: `/program`

- 视频投稿与审核系统
- BV号视频嵌入播放
- 奉纳者信息显示（实际上传者，非B站原作者）
- 视频分类筛选

### 8.3 签到排行

**路由**: `/checkin-rank`（需登录）

- 每日签到功能
- 签到排行榜展示
- 积分统计

### 8.4 个人中心

**路由**: `/user-center`（需登录）

- 用户个人信息管理
- B站UID绑定
- 头像管理

### 8.5 管理后台新增功能

**路由**: `/admin`

| 功能模块 | 说明 |
| ------ | ---- |
| 绘马帐管理 | 审核、编辑、删除、通过（仅大神主和神主可见） |
| 祝词管理 | 审核、试听、编辑、删除、通过（仅大神主和神主可见） |
| 祭礼表管理 | 待审核/已审核视频列表、视频详情、标题自动获取 |
| ChatRoom管理 | 弹幕、评论、表情、绘马、祝词管理 |
| 移动端快捷导航 | 768px以下显示，包含5个管理快捷入口 |

***

## 附录

### A. 用户权限说明

| permission值 | 角色    | 说明   |
| ----------- | ----- | ---- |
| 0           | 大神主  | 最高权限 |
| 1           | 神主   | 管理权限 |
| 2           | 管理员   | 基本管理权限 |
| 3           | 普通用户  | 基本权限 |

### B. 创建用户脚本

**文件位置**: `backend/create-user.js`

```bash
# 使用方法
node create-user.js [用户名] [账号] [密码] [权限]

# 示例
node create-user.js 管理员 admin@123.com 123456 2
```

### C. 常见问题

1. **413 错误**: 检查nginx配置中的 `client_max_body_size` 是否足够大
2. **CORS错误**: 检查 `backend/configs/config.yaml` 中的 domainName 白名单
3. **Token无效**: 清除浏览器localStorage重新登录
4. **数据库表不存在**: 重启后端会自动创建表
5. **头像不显示**: 用户需重新登录以获取 bilibili_uid 字段

### D. 修改记录

详细的修改历史请参考 [Change.md](./Change.md)。

***

*本文档最后更新于 2026-04-18*
