<script setup>
import { useRouter } from 'vue-router'
import { ref, onMounted, watch, computed, onBeforeUnmount } from 'vue'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Loading, Warning } from '@element-plus/icons-vue'
import { Plus } from '@element-plus/icons-vue'
import { getAlbums, createAlbum } from '@/api/album'
import img from '@/assets/背景图.jpg'

const router = useRouter()

// 用户状态
const userStore = useUserStore()
const { isAuthenticated } = storeToRefs(userStore)

// 新建相册相关
const createDialogVisible = ref(false)
const createForm = ref({
  title: '',
  tip: ''
})

const createFormRules = {
  title: [
    { required: true, message: '请输入绘马帐名称', trigger: 'blur' },
    { min: 1, max: 20, message: '绘马帐名称长度应在1-20个字符', trigger: 'blur' }
  ],
  tip: [
    { max: 100, message: '介绍长度不能超过100个字符', trigger: 'blur' }
  ]
}

// 相册数据
const imgList = ref({
  photoAlbum: [],
  latestPhotos: []
})
const loading = ref(false)
const error = ref(null)

// 获取相册数据
async function fetchAlbums() {
  try {
    loading.value = true
    error.value = null
    const response = await getAlbums()
    imgList.value = response.data
  } catch (err) {
    error.value = '获取绘马帐失败，请稍后重试'
    ElMessage.error('获取绘马帐失败，请稍后重试')
    // 设置默认空数据
    imgList.value = {
      photoAlbum: [],
      latestPhotos: []
    }
  } finally {
    loading.value = false
  }
}

// 新建相册相关函数
function openCreateDialog() {
  createDialogVisible.value = true
  createForm.value = {
    title: '',
    tip: ''
  }
}

function closeCreateDialog() {
  createDialogVisible.value = false
}

async function handleCreateAlbum() {
  // 表单验证
  if (!createForm.value.title.trim()) {
    ElMessage.error('请输入绘马帐名称')
    return
  }

  try {
    const albumData = {
      name: createForm.value.title.trim(),
      introduction: createForm.value.tip.trim() || undefined
    }

    const response = await createAlbum(albumData)

    ElMessage.success(`绘马帐"${response.data.name}"创建成功！`)

    // 重新获取相册列表以显示新创建的相册
    await fetchAlbums()

    closeCreateDialog()
  } catch (err) {
    let errorMessage = '创建绘马帐失败，请稍后重试'

    if (err.response) {
      const { status, data } = err.response
      switch (status) {
        case 400:
          errorMessage = data.message || '绘马帐名称不能为空'
          break
        case 401:
          errorMessage = '未认证，请先参拜'
          break
        default:
          errorMessage = data.message || errorMessage
      }
    }

    ElMessage.error(errorMessage)
  }
}

// 查看相册详情
function viewAlbum(albumId) {
  router.push(`/photo-album/${albumId}`)
}

// URL转换函数
function getFullImageUrl(relativeUrl) {
  if (!relativeUrl) return img
  if (relativeUrl.startsWith('http')) return relativeUrl
  if (relativeUrl.startsWith('/api/')) {
    const baseUrl = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : (import.meta.env.VITE_APP_BASE_URL?.replace('/api', '') || '')
    return baseUrl + relativeUrl
  }
  const baseUrl = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : import.meta.env.VITE_APP_BASE_URL
  return baseUrl + relativeUrl
}

function disableContextMenu(e) {
    const target = e.target
    if (target.tagName === 'IMG' || target.tagName === 'IMAGE' || target.closest('img') || target.closest('.el-image')) {
        e.preventDefault()
    }
}
function disableKeyboardShortcuts(e) {
    if (e.key === 'F12') e.preventDefault()
    if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) e.preventDefault()
    if (e.ctrlKey && ['s', 'u', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
}
function disableDrag(e) {
    if (e.target.tagName === 'IMG') e.preventDefault()
}
function startDevToolsDetection() {
    setInterval(() => {
        const threshold = 160
        if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a1a;color:#fff;font-size:24px;">⛩️ 检测到开发者工具，页面已保护</div>'
        }
    }, 1000)
}

// 组件挂载时获取相册数据
onMounted(() => {
    document.addEventListener('contextmenu', disableContextMenu)
    document.addEventListener('keydown', disableKeyboardShortcuts)
    document.addEventListener('dragstart', disableDrag)
    startDevToolsDetection()
    fetchAlbums()
})

onBeforeUnmount(() => {
    document.removeEventListener('contextmenu', disableContextMenu)
    document.removeEventListener('keydown', disableKeyboardShortcuts)
    document.removeEventListener('dragstart', disableDrag)
})
</script>

<template>
  <div class="kamihome-photo-page">
    <div class="content-wrapper">
      <!-- 神社标题区 -->
      <section class="shrine-hero">
        <div class="hero-content">
          <h1 class="hero-title">
            <span class="hero-icon">🦊</span> 绘马帐 <span class="hero-icon">🎴</span>
          </h1>
          <p class="hero-subtitle">记录缘结时刻，与君共赏美好</p>
        </div>
      </section>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-fox">
          <span class="fox-tail"></span>
          <span class="fox-tail"></span>
          <span class="fox-tail"></span>
        </div>
        <p>绘马加载中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-empty description="缘结失败" :image-size="80">
          <template #image>
            <el-icon size="80" class="error-icon">
              <Warning />
            </el-icon>
          </template>
          <el-button @click="fetchAlbums" class="kamihome-btn">重新祈愿</el-button>
        </el-empty>
      </div>

      <!-- 空状态 -->
      <div v-else-if="imgList.photoAlbum.length === 0" class="empty-state">
        <el-empty description="暂无绘马帐" :image-size="80">
          <template #image>
            <el-icon size="80" class="empty-icon">
              <Picture />
            </el-icon>
          </template>
          <template v-if="isAuthenticated" #default>
            <el-button type="danger" @click="openCreateDialog" class="kamihome-btn">
              <el-icon><Plus /></el-icon>
              创建第一个绘马帐
            </el-button>
          </template>
        </el-empty>
      </div>

      <!-- 绘马帐网格 -->
      <div v-else class="album-grid">
        <div class="album-card kamihome-card" v-for="album in imgList.photoAlbum" :key="album.id" @click="viewAlbum(album.id)">
          <div class="card-image">
            <img :src="getFullImageUrl(album.img)" :alt="album.title" />
            <div class="card-overlay">
              <div class="overlay-content">
                <h3>{{ album.title }}</h3>
                <p>{{ album.tip || '暂无介绍' }}</p>
                <span class="photo-count">
                  {{ album.photoCount }} 枚绘马
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 新建绘马帐卡片 -->
        <div v-if="isAuthenticated" class="album-card create-card kamihome-card" @click="openCreateDialog">
          <div class="card-image create-image">
            <div class="create-content">
              <el-icon size="48" class="create-icon">
                <Plus />
              </el-icon>
              <div class="create-text">新建绘马帐</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 最新绘马预览区 -->
      <div class="preview-section kamihome-card">
        <div class="preview-header">
          <h2>
            <span class="preview-icon">🌸</span> 最新绘马 <span class="preview-icon">🌸</span>
          </h2>
        </div>

        <div v-if="imgList.latestPhotos.length === 0" class="photo-empty-state">
          <el-empty description="暂无最新绘马" :image-size="60">
            <template #image>
              <el-icon size="60" class="photo-empty-icon">
                <Picture />
              </el-icon>
            </template>
          </el-empty>
        </div>
        <div v-else class="photo-grid">
          <div class="photo-item" v-for="photo in imgList.latestPhotos" :key="photo.id">
            <el-image :src="getFullImageUrl(photo.img)" :alt="photo.title" fit="cover"
              :preview-src-list="[getFullImageUrl(photo.img)]" :initial-index="0" hide-on-click-modal
              style="width: 100%;height: 100%; image-rendering: auto;" preview-teleported>
              <template #error>
                <div class="image-viewer-slot image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <div class="photo-overlay">
              <div class="photo-overlay-content">
                <h4>{{ photo.title }}</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新建绘马帐对话框 -->
      <el-dialog v-model="createDialogVisible" title="🎴 新建绘马帐" width="500px" :close-on-click-modal="false" custom-class="kamihome-dialog">
        <el-form :model="createForm" :rules="createFormRules" ref="createFormRef" label-width="90px">
          <el-form-item label="帐名" prop="title">
            <el-input v-model="createForm.title" placeholder="请输入绘马帐名称" maxlength="20" show-word-limit />
          </el-form-item>

          <el-form-item label="介绍" prop="tip">
            <el-input v-model="createForm.tip" type="textarea" placeholder="请输入介绍（可选）" maxlength="100" show-word-limit :rows="3" />
          </el-form-item>
        </el-form>

        <template #footer>
          <span class="dialog-footer">
            <el-button @click="closeCreateDialog" class="kamihome-btn">取消</el-button>
            <el-button type="danger" @click="handleCreateAlbum" class="kamihome-btn">
              创建绘马帐
            </el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-photo-page {
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
  max-width: 1600px;
  margin: 0 auto;
}

/* 神社标题区 */
.shrine-hero {
  text-align: center;
  margin-bottom: 32px;
  padding: 40px 20px;
  background: rgba(255, 250, 240, 0.7);
  backdrop-filter: blur(5px);
  border: 2px solid #c33a2b;
  border-radius: 20px 20px 20px 6px;
  box-shadow: 0 5px 0 #9b2a1a, 0 8px 16px rgba(160, 60, 40, 0.1);
}

.hero-title {
  font-size: clamp(2rem, 5vw, 3rem);
  color: #5e2c1a;
  font-weight: 700;
  text-shadow: 3px 3px 0 #f0d8c0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.hero-icon {
  font-size: 2.2rem;
}

.hero-subtitle {
  font-size: 1.2rem;
  color: #7a3a28;
  font-style: italic;
}

/* 加载动画 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #5e2c1a;
}

.loading-fox {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.fox-tail {
  width: 10px;
  height: 30px;
  background: #c33a2b;
  border-radius: 10px 10px 2px 2px;
  animation: foxSway 1.2s infinite ease-in-out;
}

@keyframes foxSway {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
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

/* 绘马帐网格 */
.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 36px;
}

.album-card {
  height: 220px;
  cursor: pointer;
}

.album-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 0 #9b2a1a, 0 12px 20px rgba(160, 60, 40, 0.15);
}

.card-image {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.album-card:hover .card-image img {
  transform: scale(1.05);
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top,
      rgba(90, 40, 20, 0.9) 0%,
      rgba(160, 60, 40, 0.5) 50%,
      transparent 100%);
  display: flex;
  align-items: flex-end;
  padding: 18px;
  box-sizing: border-box;
}

.overlay-content {
  color: #fff5e0;
  width: 100%;
}

.overlay-content h3 {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.overlay-content p {
  margin: 0 0 8px 0;
  font-size: 13px;
  opacity: 0.9;
}

.photo-count {
  display: inline-block;
  background: rgba(200, 60, 40, 0.8);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #fff5e0;
}

/* 新建卡片 */
.create-card {
  border: 2px dashed #c33a2b;
  background: rgba(245, 230, 211, 0.4);
}

.create-card:hover {
  background: #fce4d6;
  border-style: solid;
}

.create-image {
  display: flex;
  align-items: center;
  justify-content: center;
}

.create-content {
  text-align: center;
  color: #7a3a28;
}

.create-icon {
  color: #c33a2b;
  margin-bottom: 12px;
}

.create-text {
  font-size: 16px;
  font-weight: 600;
  color: #5e2c1a;
}

/* 最新绘马预览区 */
.preview-section {
  padding: 24px;
}

.preview-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px dashed #c33a2b;
}

.preview-header h2 {
  margin: 0;
  font-size: 24px;
  color: #5e2c1a;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.preview-icon {
  font-size: 24px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.photo-item {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 0 #9b2a1a;
  border: 1.5px solid #c33a2b;
  height: 150px;
  width: 150px;
  position: relative;
}

.photo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to top,
      rgba(90, 40, 20, 0.8) 0%,
      transparent 100%);
  display: flex;
  align-items: flex-end;
  padding: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
  box-sizing: border-box;
  pointer-events: none;
}

.photo-item:hover .photo-overlay {
  opacity: 1;
}

.photo-overlay-content h4 {
  margin: 0;
  color: #fff5e0;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* 空状态 */
.error-state, .empty-state {
  padding: 40px 20px;
  text-align: center;
}

.error-icon, .empty-icon, .photo-empty-icon {
  color: #c33a2b;
}

/* 响应式 */
@media (max-width: 768px) {
  .kamihome-photo-page {
    padding: 16px;
  }
  .shrine-hero {
    padding: 30px 16px;
  }
  .hero-title {
    font-size: 2rem;
  }
  .album-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  .preview-section {
    padding: 16px;
  }
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  .photo-item {
    height: 120px;
    width: 120px;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 1.6rem;
  }
  .hero-subtitle {
    font-size: 1rem;
  }
  .album-card {
    height: 180px;
  }
}
</style>