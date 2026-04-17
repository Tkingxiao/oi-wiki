# 修改记录

## 2026-04-17

### 1. TOP页头像来源修改

**问题描述：** TOP页右上角名字点开后的头像使用的是本地静态文件 `/src/assets/用户.jpg`，需要改为使用后端存储的用户头像，与admin.vue中氏子目录的用户头像保持一致。

**修改内容：**

1. **后端登录API** (`backend/src/services/user.js` L149-L156)
   - 在登录响应中添加了 `bilibili_uid` 字段
   - 使前端能获取用户的B站UID用于头像URL构建
2. **前端用户Store** (`frontend/src/stores/user.js` L47-L53)
   - 在登录时将 `bilibili_uid` 保存到用户信息中
   - 存储到 localStorage 以便后续使用
3. **TOP页组件** (`frontend/src/components/Top.vue` L130-L134)
   - 修改 `userAvatar` 计算属性
   - 优先使用 `/api/images/avatar/${bilibili_uid}.jpg` 获取后端头像
   - 其次使用 `user.avatar` 字段
   - 最后使用本地默认头像

**注意事项：** 用户需要重新登录才能生效（旧数据中无 bilibili\_uid 字段）

---

### 2. 结缘之间视频奉纳者显示修复

**问题描述：** 结缘之间中视频的奉纳者显示错误，显示的是B站视频原作者而非上传该视频到平台的用户。

**修改内容：**

1. **后端获取审核通过BV列表API** (`backend/src/services/bilibiliVideo.js` L254-L267)
   - 修改 `getAuditedBvList` 函数
   - 使用 LEFT JOIN 关联 `audited_bv` 表和 `video_submissions` 表
   - 返回实际上传者的 `user_id`、`user_name`、`user_avatar` 信息
2. **前端Program.vue** (`frontend/src/views/Program.vue` L345-L399)
   - 修改 `fetchVideoDetail` 函数，不再从B站API获取上传者
   - 修改 `fetchVideos` 函数，优先使用后端返回的 `item.user_name` 作为奉纳者
   - 确保显示的是上传视频到平台的用户，而非B站原作者

**修复后效果：**
- 奉纳者显示为上传该视频到平台的**用户**
- 不再错误显示B站视频原作者

---

### 3. 删除投稿备注显示

**问题描述：** 视频卡片下方的投稿备注（如"管理员 xxxxx 投稿"）不需要显示。

**修改内容：**

1. **前端Program.vue** (`frontend/src/views/Program.vue` L114)
   - 删除 `<div v-if="video.note" class="video-note">{{ video.note }}</div>` 行
   - 不再显示 `video.note` 字段内容

---

### 4. 注册查询UID增加降级API

**问题描述：** 注册界面查询B站UID时，单一API `/x/space/acc/info` 容易触发"请求过于频繁"错误（code=-799），导致无法获取用户信息。

**修改内容：**

1. **后端bilibiliUser.js** (`backend/src/services/bilibiliUser.js` L1-L68)
   - 在 `getBilibiliUserInfo` 函数中添加降级逻辑
   - 先尝试 `/x/space/acc/info` API
   - 如果失败（请求错误或返回错误码），自动降级使用 `/x/web-interface/card?mid=${uid}` API
   - 从第二个API的 `data.card.name` 和 `data.card.face` 获取用户名和头像
   - 两个API都失败才返回 `null`

**前端无需修改** - 函数签名和返回值保持一致

---

### 5. Admin界面祭礼表目录翻页按钮位置调整

**问题描述：** 祭礼表目录中的翻页按钮位置偏上，需要往下移动。

**修改内容：**

1. **前端Admin.vue** (`frontend/src/views/Admin.vue` L146)
   - 为 `el-pagination` 组件添加 `style="margin-top: 16px;"`
   - 翻页按钮向下移动，与列表内容保持适当间距

---

### 6. ChatRoom评论区表情面板位置调整

**问题描述：** 评论区打开的表情框需要向右移动，贴近动态栏右边。

**修改内容：**

1. **前端ChatRoom.vue** (`frontend/src/views/ChatRoom.vue` L565-L598)
   - 修改 `updateCommentEmojiPanelPosition` 函数
   - 将 `left` 从 `rect.left`（表情按钮对齐）改为 `window.innerWidth - panelWidth - 150`
   - 表情面板固定显示在屏幕右侧区域
   - 垂直方向保持原有的上下位置判断逻辑不变

---

### 7. 修复bilibiliUser.js中logger未定义问题

**问题描述：** `bilibiliUser.js` 中使用了未定义的 `logger` 变量，在独立脚本（如 `create-user.js`）调用时导致 `ReferenceError`。

**修改内容：**

1. **后端bilibiliUser.js** (`backend/src/services/bilibiliUser.js`)
   - 将 `logger.warn()` 和 `logger.error()` 替换为 `console.warn()` 和 `console.error()`
   - 确保该服务在独立脚本和主应用中都能正常运行

---

### 8. 修复create-user.js中global.db未初始化问题

**问题描述：** `create-user.js` 创建数据库连接后未赋值给 `global.db`，导致 `bilibiliUser.js` 中调用时 `global.db.prepare()` 报错。

**修改内容：**

1. **后端create-user.js** (`backend/create-user.js`)
   - 在创建数据库连接后添加 `global.db = db;`
   - 确保依赖 `global.db` 的服务函数能正常访问数据库

---

### 9. 修复氏子目录大航海等级显示

**问题描述：** 氏子详情中显示的大航海等级为 0，因为 `guard_level` 来自 LEFT JOIN 的 `guard_cache` 表，当无缓存时为 0，`??` 运算符不会将其视为空值。

**修改内容：**

1. **前端Admin.vue** (`frontend/src/views/Admin.vue` L248)
   - 将 `guard_level ?? medal_level ?? 0` 改为 `medal_level ?? guard_level ?? 0`
   - 优先使用 `user` 表中存储的实际 `medal_level` 值

---

### 10. 修复updateGuardCache.js中user表同步

**问题描述：** `updateGuardCache.js` 独立运行时大航海等级未同步到 `user` 表。

**修改内容：**

1. **后端updateGuardCache.js** (`backend/src/services/updateGuardCache.js` saveCache函数)
   - 在保存缓存后，将 `medal_level` 同步更新到 `user` 表
   - 通过 `bilibili_uid` 关联匹配用户

---

### 11. Admin界面移动端快捷导航

**问题描述：** 移动端需要更直观的管理入口，侧边栏占用过多空间。

**修改内容：**

1. **前端Admin.vue**
   - 添加 `mobile-nav` 区域（仅768px以下显示），包含5个管理快捷按钮
   - 移动端隐藏原有侧边栏
   - 桌面端隐藏移动端导航按钮
   - 按钮支持高亮当前选中的管理面板

---

### 12. Admin界面缘结视频详情优化

**问题描述：** 缘结视频详情页布局混乱，视频标题显示为BV号，标签与值紧贴无分隔符，奉纳时间显示缺失。

**修改内容：**

1. **前端Admin.vue** - 视频详情模板布局
   - 使用 `.video-content` 包裹封面和信息区，桌面端封面与信息横向排列
   - 信息显示顺序：缘结标题 → 奉纳者：xxx → 奉纳时间：xxx
   - 标签统一添加冒号分隔（`奉纳者：`、`奉纳时间：`）
   - 移动端垂直居中排列，封面宽度100%
2. **前端Admin.vue** - 视频标题获取
   - `fetchVideoDetail` 从B站API获取并更新标题字段
   - 模板使用 `selectedVideo.title || selectedVideo.bv` 回退显示
3. **前端Admin.vue** - 奉纳时间显示
   - 统一使用 `formatTime(selectedVideo.created_at)` 格式化时间戳
   - 与结缘之间 `video-time-row` 显示方式保持一致
4. **后端admin.js** - 待审核/已审核视频列表API
   - 为缺少标题的视频从B站API获取实际视频标题
   - 标题优先级：数据库标题 > B站API标题 > BV号
   - 已审核API补充返回 `created_at` 字段（原缺失导致无法显示奉纳时间）

---

### 13. ChatRoom图片存储路径迁移

**问题描述：** ChatRoom中上传的图片保存在 `uploads/chatRoom/` 目录，需要迁移到 `data/document/images/ChatRoom/` 统一管理，删除 `uploads` 目录。

**修改内容：**

1. **后端chatRoom.js** (`backend/src/routes/chatRoom.js`)
   - 定义常量 `CHATROOM_BASE = 'data/document/images/ChatRoom'` 和 `CHATROOM_URL_BASE = '/api/file/data/document/images/ChatRoom'`
   - 所有图片上传路径（普通图片、收藏表情、绘马图片、评论图片）统一使用新路径
   - 临时文件目录也迁移到新路径下的 `temp` 子目录
2. **后端http.js** (`backend/src/components/http.js`)
   - 移除原 `App.use('/uploads', express.static('uploads'))`
   - 新增 `App.use('/api/file/data/document/images/ChatRoom', express.static('data/document/images/ChatRoom'))`
   - 添加旧路径重定向：`/uploads/chatRoom` 301重定向到新路径，兼容数据库中已有的旧URL记录
3. **文件迁移**
   - 将 `uploads/chatRoom/` 下所有文件迁移至 `data/document/images/ChatRoom/`
   - 删除 `uploads/` 目录

---

### 14. Admin界面绘马列表/祝词列表操作栏修复

**问题描述：** 绘马帐管理和祝词管理中的列表操作栏缺少审核通过按钮。

**修改内容：**

1. **前端Admin.vue - 绘马列表** (`frontend/src/views/Admin.vue` L248-L254)
   - 在操作栏中增加"通过"按钮（`v-if="row.is_review !== 1"` 仅待审核/不通过状态显示）
   - 操作栏整体添加权限控制（`v-if="permission === 0 || permission === 1"`）
   - 仅**大神主（0）**和**神主（1）**可见操作栏，包含：通过、编辑、删除按钮

2. **前端Admin.vue - 祝词列表** (`frontend/src/views/Admin.vue` L217-L225)
   - 在操作栏中增加"通过"按钮（`v-if="row.is_review !== 1"` 仅待审核/不通过状态显示）
   - 操作栏整体添加权限控制（`v-if="permission === 0 || permission === 1"`）
   - 仅**大神主（0）**和**神主（1）**可见操作栏，包含：通过、试听、编辑、删除按钮
3. **前端Admin.vue - 表格列宽调整**
   - 名称列 `min-width` 从 `150` 缩小至 `120`
   - 奉纳者列 `width` 从 `100` 缩小至 `80`
   - 状态列 `width` 从 `80` 缩小至 `70`
   - 操作列 `width` 从 `200` 扩大至 `260`
   - 四个按钮（通过/试听/编辑/删除）保持单行排列，不再换行

---

### 15. Admin界面祭礼表预览手机端适配

**问题描述：** 祭礼表目录右侧 doc-preview 预览界面在手机上显示过大，需要横向滑动才能查看内容。

**修改内容：**

1. **前端Admin.vue** (`frontend/src/views/Admin.vue` L1296-L1298)
   - 在 768px 以下媒体查询中添加 `docx-wrapper` 缩放样式（`transform: scale(0.45)`）
   - 设置缩放原点为左上角（`transform-origin: top left`）
   - 限制预览容器高度为 400px，溢出内容可滚动
   - 针对 `<section class="docx">` 元素强制缩小宽度（`width: 100%`, `max-width: 100%`），减小内边距（`padding: 8pt 12pt`）
   - 祭礼表预览在手机端自适应缩小，无需横向滑动

---

### 16. 祭礼表页面预览面板高度调整

**问题描述：** 祭礼表页面（/plan-document）底部预览面板高度过小（420px），文档内容显示不完整。

**修改内容：**

1. **前端PlanDocument.vue** (`frontend/src/views/PlanDocument.vue` L661-L665)
   - 将 `.preview-panel-body` 高度从固定 `420px` 改为响应式 `70vh`（视口高度70%）
   - 设置最小高度 `min-height: 600px`，防止在小屏幕上过小
   - 祭礼预览面板自适应视口，显示更多内容

---

### 17. 排除 config.yaml 示例文件

**问题描述：** `backend/.gitignore` 中排除了 `examples/config.yaml`，导致示例配置文件无法提交到仓库。

**修改内容：**

1. **后端.gitignore** (`backend/.gitignore` L30)
   - 移除 `examples/config.yaml` 排除规则
   - 保留 `configs/*.yaml` 和 `configs/*.yml` 排除规则（实际配置文件）
   - 示例配置文件现在可以被提交到仓库
