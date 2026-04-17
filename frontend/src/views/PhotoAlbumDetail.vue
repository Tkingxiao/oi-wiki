<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus, Picture, UploadFilled, Download } from '@element-plus/icons-vue'
import { getAlbumPhotos, uploadPhoto } from '@/api/album'

// 路由和用户状态
const route = useRoute()
const router = useRouter()
const { isAuthenticated } = storeToRefs(useUserStore())

// 获取相册ID
const albumId = computed(() => parseInt(route.params.id))

// 相册和照片数据
const albumData = ref({
  album: null,
  photos: []
})
const loading = ref(false)
const error = ref(null)

// 上传相关
const imagePreviewUrl = ref('')

// 当前相册信息
const currentAlbum = computed(() => {
  return albumData.value.album
})

// 当前相册的照片
const albumPhotos = computed(() => {
  return albumData.value.photos
})

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 获取相册照片
async function fetchAlbumPhotos() {
  try {
    loading.value = true
    error.value = null
    const response = await getAlbumPhotos(albumId.value)
    albumData.value = response.data
  } catch (err) {
    error.value = '获取绘马帐失败，请稍后重试'
    ElMessage.error('获取绘马帐失败，请稍后重试')
    albumData.value = {
      album: null,
      photos: []
    }
  } finally {
    loading.value = false
  }
}

// 上传照片相关
const uploadVisible = ref(false)
const uploadRef = ref(null)
const uploadForm = ref({
  photo: null,
  name: ''
})

// 返回相册列表
function goBack() {
  router.push('/photo-album')
}

// 打开上传照片对话框
function openUploadDialog() {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = ''
  }
  uploadVisible.value = true
  uploadForm.value = {
    photo: null,
    name: ''
  }
}

// 处理文件选择
async function handleFileChange(file, fileList) {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = ''
  }
  uploadForm.value.photo = null
  uploadForm.value.name = ''

  if (fileList.length > 0) {
    const selectedFile = file.raw || file
    setTimeout(() => {
      if (uploadRef.value) {
        uploadRef.value.clearFiles()
      }
    }, 0)
    uploadForm.value.photo = selectedFile
    if (!uploadForm.value.name.trim()) {
      uploadForm.value.name = selectedFile.name.replace(/\.[^/.]+$/, '')
    }
    try {
      const newUrl = URL.createObjectURL(selectedFile)
      await nextTick()
      imagePreviewUrl.value = newUrl
      await nextTick()
    } catch (error) {
      // 忽略错误
    }
  }
}

// 上传照片
async function handleUploadPhotos() {
  if (!uploadForm.value.photo) {
    ElMessage.error('请选择要奉纳的绘马')
    return
  }
  if (!uploadForm.value.name.trim()) {
    ElMessage.error('请输入绘马名称')
    return
  }

  try {
    loading.value = true
    const formData = new FormData()
    formData.append('photo', uploadForm.value.photo)
    formData.append('album_id', albumId.value)
    formData.append('name', uploadForm.value.name.trim())
    const response = await uploadPhoto(formData)
    loading.value = false
    ElMessage.success(response.message || '绘马奉纳成功！')
    uploadVisible.value = false
    await fetchAlbumPhotos()
    if (imagePreviewUrl.value) {
      URL.revokeObjectURL(imagePreviewUrl.value)
      imagePreviewUrl.value = ''
    }
    uploadForm.value.photo = null
    uploadForm.value.name = ''
    if (uploadRef.value) {
      uploadRef.value.clearFiles()
    }
  } catch (error) {
    loading.value = false
    let errorMessage = '奉纳过程中发生错误，请重试'
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          errorMessage = data.message || '请求参数错误'
          break
        case 401:
          errorMessage = '未认证，请先参拜'
          break
        case 413:
          errorMessage = '绘马过大，超过10MB限制'
          break
        default:
          errorMessage = data.message || errorMessage
      }
    }
    ElMessage.error(errorMessage)
  }
}

// URL转换函数
function getFullImageUrl(relativeUrl) {
  if (!relativeUrl) return ''
  if (relativeUrl.startsWith('http')) return relativeUrl
  if (relativeUrl.startsWith('/api/')) {
    const baseUrl = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : (import.meta.env.VITE_APP_BASE_URL?.replace('/api', '') || '')
    return baseUrl + relativeUrl
  }
  const baseUrl = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : import.meta.env.VITE_APP_BASE_URL
  return baseUrl + relativeUrl
}

// 下载照片
async function downloadPhoto(photo) {
  try {
    const token = localStorage.getItem('token')
    const imageUrl = getFullImageUrl(photo.url)
    const response = await fetch(imageUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('下载失败')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${photo.name}.jpg`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('绘马已请回')
  } catch (error) {
    ElMessage.error('请回失败，请稍后再试')
  }
}

// 组件挂载时获取相册数据
onMounted(async () => {
  await fetchAlbumPhotos()
  if (!currentAlbum.value) {
    ElMessage.error('绘马帐不存在')
    router.push('/photo-album')
  }
})

// 组件卸载时清理资源
onBeforeUnmount(() => {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
})
</script>

<template>
  <div class="kamihome-photo-detail-page">
    <div class="content-wrapper">
      <!-- 返回按钮和相册信息 -->
      <div class="album-header kamihome-card">
        <div class="header-left">
          <el-button class="back-button kamihome-btn" @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回绘马帐
          </el-button>
        </div>

        <div class="album-info" v-if="currentAlbum">
          <div class="album-details">
            <h1>🎴 {{ currentAlbum.name }}</h1>
            <p>{{ currentAlbum.introduction || '暂无介绍' }}</p>
          </div>
        </div>
      </div>

      <!-- 照片网格 -->
      <div class="photos-section kamihome-card" @contextmenu.prevent>
        <div v-if="albumPhotos.length === 0" class="empty-state">
          <el-empty description="此绘马帐尚无绘马" :image-size="80">
            <template #image>
              <el-icon size="80" class="empty-icon">
                <Picture />
              </el-icon>
            </template>
            <el-button v-if="isAuthenticated" @click="openUploadDialog" class="kamihome-btn">
              <el-icon><Plus /></el-icon>
              奉纳第一枚绘马
            </el-button>
          </el-empty>
        </div>

        <div v-else class="photo-grid">
          <div v-for="photo in albumPhotos" :key="photo.id" class="photo-item">
            <el-image :src="getFullImageUrl(photo.url)" :alt="photo.name" fit="cover"
              :preview-src-list="[getFullImageUrl(photo.url)]" :initial-index="0" hide-on-click-modal
              style="width: 100%;height: 100%; image-rendering: auto;" preview-teleported>
              <template #error>
                <div class="image-viewer-slot image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <div class="photo-overlay">
              <div class="photo-overlay-content">
                <h4>{{ photo.name }}</h4>
              </div>
              <div class="photo-actions">
                <el-button v-if="isAuthenticated" @click.stop="downloadPhoto(photo)" class="kamihome-btn small" circle>
                  <el-icon><Download /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

          <!-- 卡片样式的上传按钮 -->
          <div v-if="isAuthenticated" class="photo-item upload-card" @click="openUploadDialog">
            <div class="upload-content">
              <el-icon size="48" class="upload-icon">
                <Plus />
              </el-icon>
              <div class="upload-text">奉纳绘马</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传照片对话框 -->
    <el-dialog v-model="uploadVisible" title="🎴 奉纳绘马" width="600px" :close-on-click-modal="false" custom-class="kamihome-dialog">
      <el-upload ref="uploadRef" :on-change="handleFileChange" :auto-upload="false" :show-file-list="false"
        accept="image/*" action="" drag style="width: 100%;">
        <div v-if="!uploadForm.photo" class="upload-area">
          <el-icon class="el-icon--upload">
            <component :is="UploadFilled" />
          </el-icon>
          <div class="el-upload__text">
            将绘马拖到此处，或 <em>点击选择</em>
          </div>
        </div>
        <div v-else class="upload-preview">
          <img :src="imagePreviewUrl" :key="imagePreviewUrl"
            style="width: 100%; height: 200px; border-radius: 12px; object-fit: cover; border: 2px solid #c33a2b;" alt="预览绘马" />
          <div class="preview-info">
            <p>{{ formatFileSize(uploadForm.photo.size) }}</p>
          </div>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 JPG、PNG、GIF 格式，单枚绘马最大 10MB
          </div>
        </template>
      </el-upload>

      <div style="margin-top: 20px;">
        <el-input v-model="uploadForm.name" placeholder="请输入绘马名称" maxlength="50" show-word-limit />
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadVisible = false" class="kamihome-btn">取消</el-button>
          <el-button type="danger" @click="handleUploadPhotos" :loading="loading"
            :disabled="!uploadForm.photo || !uploadForm.name.trim()" class="kamihome-btn">
            奉纳
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-photo-detail-page {
  min-height: 100vh;
  background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
  padding: 24px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
}

/* 卡片基础样式 */
.kamihome-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(5px);
  border: 2px solid #c33a2b;
  border-radius: 16px 16px 16px 6px;
  box-shadow: 0 5px 0 #9b2a1a, 0 8px 16px rgba(160, 60, 40, 0.1);
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.kamihome-card::after {
  content: '🦊';
  position: absolute;
  bottom: 8px;
  right: 16px;
  font-size: 16px;
  color: #c33a2b;
  opacity: 0.2;
}

/* 按钮样式 */
.kamihome-btn {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: bold;
  color: #5e2c1a;
  box-shadow: 0 3px 0 #9b2a1a;
  cursor: pointer;
  transition: all 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.kamihome-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a;
  background: #fce4d6;
}

.kamihome-btn.small {
  padding: 6px 10px;
}

/* 相册头部 */
.album-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  flex-shrink: 0;
}

.album-info {
  flex: 1;
  display: flex;
  justify-content: center;
}

.album-details {
  text-align: center;
}

.album-details h1 {
  margin: 0 0 8px 0;
  color: #5e2c1a;
  font-size: 28px;
  font-weight: 700;
  text-shadow: 2px 2px 0 #f0d8c0;
}

.album-details p {
  margin: 0;
  color: #7a3a28;
  font-size: 15px;
  font-style: italic;
}

/* 照片区域 */
.photos-section {
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  color: #c33a2b;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
}

.photo-item {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 0 #9b2a1a;
  border: 1.5px solid #c33a2b;
  aspect-ratio: 1 / 1;
  position: relative;
  transition: transform 0.2s;
}

.photo-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 0 #9b2a1a;
}

.photo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top,
      rgba(90, 40, 20, 0.9) 0%,
      transparent 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
  box-sizing: border-box;
  pointer-events: none;
}

.photo-item:not(.upload-card):hover .photo-overlay {
  opacity: 1;
}

.photo-overlay-content {
  color: #fff5e0;
  width: 70%;
}

.photo-overlay-content h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  pointer-events: auto;
  z-index: 10;
}

/* 上传卡片 */
.upload-card {
  border: 2px dashed #c33a2b;
  background: rgba(245, 230, 211, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-card:hover {
  background: #fce4d6;
  border-style: solid;
}

.upload-content {
  text-align: center;
  color: #7a3a28;
}

.upload-icon {
  color: #c33a2b;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  font-weight: 600;
}

/* 对话框定制 */
:deep(.kamihome-dialog) {
  background: #fef7f0 !important;
  border: 3px solid #c33a2b !important;
  border-radius: 20px !important;
  box-shadow: 0 6px 0 #9b2a1a !important;
}

:deep(.kamihome-dialog .el-dialog__header) {
  border-bottom: 2px dashed #c33a2b;
}

:deep(.kamihome-dialog .el-dialog__title) {
  color: #5e2c1a;
  font-weight: 600;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.image-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #f5e6d3;
  color: #c33a2b;
}

.upload-area {
  padding: 40px 20px;
  text-align: center;
  color: #7a3a28;
}

.upload-preview {
  padding: 16px;
  background: #f5e6d3;
  border-radius: 12px;
  border: 1.5px solid #c33a2b;
}

.preview-info {
  margin-top: 12px;
  text-align: center;
  color: #5e2c1a;
}

/* 响应式 */
@media (max-width: 768px) {
  .kamihome-photo-detail-page {
    padding: 16px;
  }
  .album-header {
    flex-direction: column;
    text-align: center;
  }
  .album-details h1 {
    font-size: 22px;
  }
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
  }
  .photos-section {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .album-details h1 {
    font-size: 18px;
  }
}
</style>