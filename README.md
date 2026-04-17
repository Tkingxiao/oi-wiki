# 黛棠OI-WIKI

一个面向黛棠OI社区的前后端一体项目，包含内容展示、公告系统、相册/音声/企划表与管理后台能力。

> 提示：当前仓库数据可能为清空状态（0 相册 / 0 音声 / 0 企划 / 0 用户），但功能代码完整可用。

## 功能说明（按当前代码）

### 前台页面

- 首页（`/`）：主播信息、直播状态、粉丝数、舰长数、直播时长统计。
- 相册（`/photo-album`、`/photo-album/:id`）：相册与照片浏览。
- 音声（`/audio`）：音频分类与播放。
- 公告（`/announcement`）：公告列表与内容展示。
- 企划表（`/plan-document`）：Word 文档列表、选中联动实时预览（支持文档内图片渲染）。
- 登录（`/login`）、个人页（`/profile`）、后台（`/admin`）。

### 管理后台

- 音频管理：审核、编辑、删除。
- 相册管理：审核、编辑、删除。
- 企划表管理：设置当前文档、删除、右侧实时预览。
- 用户管理（超管可见）：权限调整、封禁/解封、重置密码、删除。

### 后端服务

- JWT 鉴权与权限校验。
- SQLite 数据存储（`maruko-sql.db` 为主库）。
- 文件访问接口（`/api/file/*`）。
- 公告、相册、音声、企划表、用户、Bilibili 代理、AI 路由。

## 技术栈

### 前端

- Vue 3 + Vite
- Element Plus + Pinia + Vue Router
- Axios
- `docx-preview`（当前文档预览主方案）
- `@vue-office/docx`（历史依赖，仍在 `package.json` 中）

### 后端

- Node.js + Express
- better-sqlite3
- Redis（ioredis）
- jsonwebtoken / bcrypt / multer / nodemailer / log4js

## 项目结构

```text
oi-wiki/
├── frontend/
│   ├── src/
│   │   ├── views/            # 页面
│   │   ├── components/       # 组件（含 DocxPreview）
│   │   ├── api/              # 前端接口封装
│   │   ├── router/
│   │   └── stores/
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/           # 路由层
│   │   ├── services/         # 业务层
│   │   ├── method/           # 工具方法
│   │   └── components/       # 启动组件
│   ├── configs/
│   ├── data/
│   │   ├── document/         # 文件存储目录（audios/images/plans）
│   │   ├── maruko-sql.db     # 主数据库
│   │   └── maruko-wiki.db    # 额外数据库
│   └── package.json
├── sql.sql
├── sql.yaml
├── Extension.md              # 自定义修改详细指南
└── README.md
```

## 环境配置说明

### 1. 前端环境配置

**开发环境：** `frontend/.env.development`

```bash
# 后端API地址（开发环境连接本地后端）
VITE_APP_BASE_URL=http://localhost:6660

# Bilibili直播间房间号
VITE_APP_ROOM_ID=1809236885

# Bilibili用户ID（主播UID）
VITE_APP_USER_ID=3546585537448033
```

**生产环境：** `frontend/.env.production`

```bash
# 方式一：使用nginx代理（推荐）
# 前端请求 /api/* 会被nginx转发到后端，无需考虑跨域
VITE_APP_BASE_URL=/api

# 方式二：直接连接后端（需要后端配置CORS白名单）
# VITE_APP_BASE_URL=http://你的域名:6660

# Bilibili直播间房间号
VITE_APP_ROOM_ID=1809236885

# Bilibili用户ID（主播UID）
VITE_APP_USER_ID=3546585537448033
```

### 2. 后端配置文件

**文件位置：** `backend/configs/config.yaml`

```yaml
# 后端服务端口
httpPort: 6660

# 跨域白名单配置（允许访问的域名/地址）
domainName:
  - http://localhost:6660         # 本地后端
  - http://localhost:5173         # 本地开发前端 (Vite dev)
  - http://localhost:4173         # 本地预览前端 (Vite preview)
  - http://daidai.test:8080     # 本地测试域名
  - https://daidai.test:8080     # HTTPS测试域名
  # 添加你的实际域名，例如：
  # - http://your-domain.com
  # - https://your-domain.com

# JWT签名密钥
token: maruko

# 日志配置
log:
  cmd: info      # 命令行日志级别: debug, info, warn, error
  file: all      # 文件日志级别: all, debug, info, warn, error

# Redis配置
redis:
  host: localhost
  port: 6379
  password: null   # 如有密码请填写

# 邮件配置（用于发送验证码等）
email:
  # 见邮件配置章节
```

## 需要修改的内容清单

### 1. 直播间信息

| 文件位置                              | 配置项                | 当前值              |
| --------------------------------- | ------------------ | ---------------- |
| `backend/configs/config.yaml`      | `bilibili.roomId`  | 1809236885       |
| `backend/configs/config.yaml`      | `bilibili.userId`  | 3546585537448033 |
| `frontend/.env.development`       | `VITE_APP_ROOM_ID` | 1809236885       |
| `frontend/.env.development`       | `VITE_APP_USER_ID` | 3546585537448033 |
| `frontend/.env.production`        | `VITE_APP_ROOM_ID` | 1809236885       |
| `frontend/.env.production`        | `VITE_APP_USER_ID` | 3546585537448033 |
| `frontend/src/views/Home.vue`     | 主播主页链接         | 3546585537448033 |
| `frontend/src/views/Home.vue`     | 直播间链接          | 1809236885       |

### 2. 网站名称

| 文件位置                                 | 当前名称      |
| ------------------------------------ | --------- |
| `frontend/index.html`                | 黛棠OI-WIKI |
| `frontend/src/components/Top.vue`    | 黛棠OI-WIKI |
| `frontend/src/components/Bottom.vue` | 黛棠OI-WIKI |
| `frontend/src/views/Home.vue`        | 黛棠OI      |
| `frontend/src/views/Login.vue`       | 黛棠OI      |

### 3. 主播信息（Home.vue）

| 修改项 | 文件位置 | 默认值 |
| ------ | -------- | ------ |
| 主播名字 | Home.vue 第11行 `anchorName` | 黛棠OI |
| 粉丝文案 | Home.vue 第596-606行 | 猫猫/呆呆相关文案 |
| 直播时长目标 | Home.vue 第22行 `ct` / 第657行 | 90小时/月，22天有效 |
| Bilibili主页 | Home.vue 第568行 | space.bilibili.com/3546585537448033 |
| 直播间链接 | Home.vue 第770行 | live.bilibili.com/1809236885 |

### 4. 备案号

| 文件位置                                 | 配置项              |
| ------------------------------------ | ---------------- |
| `frontend/src/components/Bottom.vue` | 辽ICP备2024032879号 |

### 5. 主题颜色

主题颜色已修改为粉色系（#FF85A2 / #FFF2F4）

如需修改蓝色主题，请在以下文件中搜索 `#FF85A2` 并替换为所需颜色：

- `frontend/src/components/Top.vue`
- `frontend/src/views/Home.vue`
- `frontend/src/views/Admin.vue`
- `frontend/src/views/Announcement.vue`
- `frontend/src/views/Audio.vue`
- `frontend/src/views/PhotoAlbum.vue`
- `frontend/src/views/PhotoAlbumDetail.vue`
- `frontend/src/views/PlanDocument.vue`
- `frontend/src/views/Profile.vue`

### 6. 图片资源

| 修改项 | 文件位置 | 说明 |
| ------ | -------- | ------ |
| 用户头像 | `frontend/src/components/Top.vue` | 导入 `@/assets/用户.jpg` |
| 首页背景 | `frontend/src/views/Home.vue` CSS | 修改 background-image URL |

### 7. Token Key（已统一）

| 文件位置                          | Key       |
| ----------------------------- | --------- |
| `frontend/src/stores/user.js` | oi_token |
| `frontend/src/utils/http.js`  | oi_token |
| `frontend/src/api/audio.js`   | oi_token |

### 8. 第三方链接

| 文件位置                                 | 链接                                               |
| ------------------------------------ | ------------------------------------------------ |
| `frontend/src/components/Bottom.vue` | Gitee: <https://gitee.com/xiaofeiawa/oi-wiki/>   |
| `frontend/src/components/Bottom.vue` | GitHub: <https://github.com/xiaofei114/oi-wiki/> |
| `frontend/src/components/Bottom.vue` | 爱发电: <https://afdian.com/a/xiaofeiqwq/>          |

### 9. 页面文字

| 文件位置                                | 内容     |
| ----------------------------------- | ------ |
| `frontend/src/views/Home.vue`       | 粉丝统计文字 |
| `frontend/src/views/Audio.vue`      | 呆呆音声   |
| `frontend/src/views/PhotoAlbum.vue` | 呆呆相簿   |

## 本地开发

### 1. 环境要求

- Node.js `>= 20`
- pnpm
- Redis
- SQLite3（可选，用于手动导入 SQL）

### 2. 安装依赖

```bash
cd backend
pnpm install

cd ../frontend
pnpm install
```

### 3. 准备配置

在 `backend/configs/` 放置配置文件（可参考 `backend/examples/config.yaml`）。

### 4. 启动项目

后端已支持自动建表，首次启动会自动创建所需数据库表。

```bash
# 终端1：后端
cd backend
pnpm start

# 终端2：前端（开发模式）
cd frontend
pnpm dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:6660`

### 5. 本地预览（生产构建）

```bash
# 终端1：后端
cd backend
pnpm start

# 终端2：前端构建并预览
cd frontend
pnpm build
pnpm preview
```

默认预览地址：`http://localhost:4173`

## 部署说明

### 1. 后端部署

```bash
cd backend
pnpm install --prod
pnpm start
```

建议使用 PM2 托管：

```bash
pnpm add -g pm2
pm2 start app.js --name oi-backend
pm2 save
```

### 2. 前端部署

```bash
cd frontend
pnpm install
pnpm build
```

将构建产物 `frontend/dist` 部署到 Nginx 静态目录。

### 3. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 文件上传大小限制（根据需要调整）
    client_max_body_size 100M;

    # 前端静态文件
    location / {
        root /var/www/oi/frontend/dist;
        index index.html;
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

### 4. 部署检查清单

- [ ] 后端配置 `backend/configs/config.yaml` 中的 domainName 已添加你的域名
- [ ] 前端已构建 `pnpm build`
- [ ] Nginx 已配置 `client_max_body_size`（文件上传限制）
- [ ] Redis 服务已启动（如果使用）
- [ ] 防火墙已开放所需端口

## 常见问题

### 1) 原生模块安装失败（better-sqlite3 / bcrypt）

- Windows 需安装 Python 与 C++ Build Tools。
- 建议删除 `node_modules` 后重新安装。
- 使用 pnpm 时运行 `pnpm approve-builds` 允许编译。

### 2) Redis 连接失败

- 检查 Redis 服务是否启动，配置是否正确。

### 3) 413 文件过大错误

- 检查 Nginx 配置中的 `client_max_body_size` 是否足够大
- 确保在 server 块中添加：`client_max_body_size 100M;`

### 4) CORS 跨域错误

- 检查 `backend/configs/config.yaml` 中的 domainName 白名单
- 确保你的域名已添加到白名单

### 5) Token 无效/未授权

- 清除浏览器 localStorage 重新登录

### 6) 页面显示空数据

- 当前仓库可能已清空业务数据，属正常现象；可通过后台创建或导入数据库数据。

## 附录

### A. 用户权限说明

| permission值 | 角色    | 说明   |
| ----------- | ----- | ---- |
| 1           | 超级管理员 | 最高权限 |
| 2           | 管理员   | 管理权限 |
| 3           | 普通用户  | 基本权限 |

### B. 创建用户脚本

**文件位置:** `backend/create-user.js`

```bash
# 使用方法
node create-user.js [用户名] [账号] [密码] [权限]

# 示例
node create-user.js 管理员 admin@123.com 123456 2
```

### C. 更多自定义修改

详细的自定义修改指南请参考 [Extension.md](./Extension.md)。

## 许可证

BSD 3-Clause，详见 `LICENSE`。
