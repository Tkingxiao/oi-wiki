# 修改记录

## 2026-04-18

### 1. 移植 COS（腾讯云对象存储）功能

**问题描述：** 服务器版本（ubuntuget）包含 COS 云存储功能，本地版本（oi-wiki）缺少此功能，需要将 COS 功能完整移植到本地版本中。

**修改内容：**

#### 1.1 新增 COS 服务文件

**文件：** `backend/src/services/cos.js`（新建）

**核心功能：**
- L11-L31 `initCOS()` - 初始化 COS 客户端
- L37-L42 `isCOSAvailable()` - 检查 COS 是否已配置并可用
- L48-L81 `uploadToCOS()` - 上传文件到 COS
- L87-L112 `deleteFromCOS()` - 从 COS 删除文件
- L118-L123 `generateCOSKey()` - 生成 COS 对象键
- L129-L142 `isCOSUrl()` - 判断 URL 是否是 COS URL
- L148-L171 `extractKeyFromCOSUrl()` - 从 COS URL 中提取对象键

#### 1.2 更新 package.json

**文件：** `backend/package.json`

**修改：** L20 - 添加 `cos-nodejs-sdk-v5` 依赖（版本 `^2.14.9`）

#### 1.3 更新配置文件

**文件 1：** `backend/examples/config.yaml`
- L60-L67 - 添加 COS 配置块（示例配置）

**文件 2：** `backend/configs/config.yaml`
- L61-L68 - 添加 COS 配置块（实际配置）

#### 1.4 更新音声服务

**文件：** `backend/src/services/audio.js`

**修改：**
- L3 - 导入 COS 相关函数
- L50-L53 - `getAudiosGrouped()` - 支持 COS URL 和本地路径双模式
- L108-L134 - `uploadAudio()` - 支持上传到 COS，使用随机文件名防止冲突
- L183-L186 - `getAudiosForAdmin()` - 支持 COS URL 显示
- L230-L249 - `deleteAudio()` - 支持删除 COS 文件和本地文件
- L24 - 扩展支持的音频格式：mp3, wav, ogg, mpeg

#### 1.5 更新相册服务

**文件：** `backend/src/services/album.js`

**修改：**
- L5 - 导入 COS 相关函数
- L25-L27 - `getAlbumsWithLatestPhotos()` - 支持 COS URL 和本地路径
- L37-L38 - `getAlbumsWithLatestPhotos()` - 处理最新照片 URL
- L53-L54 - `getPhotos()` - 支持 COS URL 显示
- L96-L120 - `uploadPhoto()` - 支持上传到 COS，使用相册文件夹组织
- L136-L137 - `getAlbumsForAdmin()` - 支持 COS URL 显示
- L190-L223 - `deleteAlbum()` - 支持删除 COS 文件和本地文件
- L275-L284 - `deletePhoto()` - 支持删除 COS 文件和本地文件

#### 1.6 更新头像服务

**文件：** `backend/src/services/avatarService.js`

**修改：**
- L5 - 导入 COS 相关函数
- L13 - 添加 `COS_BASE` 常量
- L83-L95 - `downloadAvatar()` - 支持上传到 COS 或本地存储

**配置说明：**

`backend/configs/config.yaml` 中的 COS 配置格式：

```yaml
cos:
  secretId: '你的 SecretId'
  secretKey: '你的 SecretKey'
  bucket: '你的 Bucket 名称'
  region: '地域代码（如 ap-shanghai）'
  customDomain: '自定义域名（可选）'
  useHTTPS: true
```

**已完成的 COS 功能移植：**

1. **cos.js** - 完整的 COS 服务模块（新建文件）
2. **audio.js** - 音声上传、删除、获取支持 COS（L3, L24, L50-L53, L108-L134, L183-L186, L230-L249）
3. **album.js** - 相册照片上传、删除、获取支持 COS（L5, L25-L27, L37-L38, L53-L54, L96-L120, L136-L137, L190-L223, L275-L284）
4. **avatarService.js** - 头像下载支持 COS（L5, L13, L83-L95）
5. **配置文件** - examples/config.yaml（L60-L67）和 configs/config.yaml（L61-L68）都已更新

**注意事项：**
- 运行 `npm install` 或 `pnpm install` 安装新的依赖
- 需要在配置文件中填写正确的 COS 凭据才能启用云存储功能
- 未配置 COS 时系统会自动使用本地存储，不影响现有功能
- 所有文件上传功能都支持双模式，自动根据配置选择存储方式
