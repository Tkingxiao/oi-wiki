第二次修正

## 2026-04-18

### 1. 仓库地址更新

**修改内容：**

1. **前端Bottom.vue** (`frontend/src/components/Bottom.vue` L6-L7)
   - Gitee地址从 `https://gitee.com/xiaofeiawa/oi-wiki/` 更新为 `https://gitee.com/jing-xiao/oi-wiki/`
   - GitHub地址从 `https://github.com/xiaofei114/oi-wiki/` 更新为 `https://github.com/Tkingxiao/oi-wiki/`

***

### 2. README.md 文档更新

**修改内容：**

1. **项目描述更新**
   - 功能说明中新增了 ChatRoom、节目大全、签到排行、个人中心等前台页面
   - 管理后台新增了绘马帐管理、祝词管理、祭礼表管理、ChatRoom管理等功能说明
   - 后端服务新增了 ChatRoom相关服务、签到系统、视频投稿审核系统
2. **原作者授权声明**
   - 在项目描述开头添加了基于 [maruko-wiki](https://github.com/xiaofei114/maruko-wiki) 修改而来的声明
   - 标明已获得原作者授权
3. **第三方链接更新**
   - Gitee链接更新为 `https://gitee.com/jing-xiao/oi-wiki/`
   - GitHub链接更新为 `https://github.com/Tkingxiao/oi-wiki/`
4. **项目结构更新**
   - 新增了 `Change.md` 修改记录文件的说明
5. **附录更新**
   - 新增了 D. 修改记录，引用 Change.md

***

### 3. Extension.md 文档更新

**修改内容：**

1. **原作者授权声明**
   - 在文档开头添加了基于 [maruko-wiki](https://github.com/xiaofei114/maruko-wiki) 修改而来的声明
2. **数据库表扩展**（3.3节）
   - 新增了 checkin、danmaku、comment、emoji、ema、norito、video\_submissions、audited\_bv、guard\_cache 等数据库表说明
3. **前端自定义修改扩展**
   - 新增 2.5节 底部链接修改（Gitee、GitHub、爱发电、品牌名称、备案号）
4. **图片资源修改扩展**（第4章）
   - 新增 4.3节 用户头像来源说明（后端存储头像，需重新登录生效）
5. **文本内容修改扩展**（第5章）
   - 新增 5.3节 第三方链接（当前仓库地址）
6. **部署配置扩展**（第7章）
   - 新增 7.3节 文件存储路径说明（ChatRoom图片迁移至 `data/document/images/ChatRoom/`）
7. **新增功能说明**（第8章，全新章节）
   - 8.1 ChatRoom 社区聊天室（弹幕、评论、表情、绘马、祝词、图片）
   - 8.2 节目大全/结缘之间（视频投稿审核、BV号播放、奉纳者信息）
   - 8.3 签到排行（每日签到、排行榜、积分统计）
   - 8.4 个人中心（用户信息管理、B站UID绑定、头像管理）
   - 8.5 管理后台新增功能（绘马帐、祝词、祭礼表、ChatRoom管理、移动端导航）
8. **用户权限说明更新**（附录A）
   - 新增了 大神主(0) 和 神主(1) 权限等级
9. **常见问题扩展**（附录C）
   - 新增了 头像不显示 的常见问题（需重新登录获取 bilibili\_uid）
10. **附录新增**
    - 新增 D. 修改记录，引用 Change.md
11. **文档更新日期**
    - 最后更新日期更新为 2026-04-18

***

### 4. 修行详情时间计算修复

**修改内容：**

1. **前端Home.vue** (`frontend/src/views/Home.vue`)
   - `generateFakeLiveData` 函数中跨日直播时长计算忽略秒数导致精度误差
   - 修复总时长计算：将 `(24 - sd.getHours()) * 60 - sd.getMinutes()` 改为基于秒级精度计算
   - 修复有效天数判断：同步修正秒数计算逻辑
   - 修复前示例：`14:30:45` 开播跨日，计算为 `(24-14)*60-30=570` 分钟，实际应为 `569` 分钟（含45秒）
   - 修复后使用 `sd.getHours() * 3600 + sd.getMinutes() * 60 + sd.getSeconds()` 获取精确秒数

***

### 5. 数据库WAL模式清理

**修改内容：**

1. **禁用SQLite WAL模式**
   - `backend/src/components/sql.js` - 添加 `db.pragma('journal_mode = DELETE')`
   - `backend/src/services/updateGuardCache.js` - 添加 `db.pragma('journal_mode = DELETE')` 和 `db.pragma('foreign_keys = ON')`
   - 防止再生成 `.db-wal` 和 `.db-shm` 临时文件

2. **清理多余数据库文件**
   - 已删除 `backend/data/maruko-sql.db-wal`
   - 已删除 `backend/data/maruko-sql.db-shm`
   - data目录下仅保留 `maruko-sql.db` 主数据库文件

