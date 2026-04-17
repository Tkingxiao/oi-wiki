<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Warning, Document, Delete, Download } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { getPlanDocuments, uploadPlanDocument, deletePlanDocument, setCurrentPlanDocument } from '@/api/planDocument'
import DocxPreview from '@/components/DocxPreview.vue'

const userStore = useUserStore()
const { isAuthenticated, permission } = storeToRefs(userStore)

const isAdmin = computed(() => permission.value <= 2)

const planDocuments = ref([])
const loading = ref(false)
const error = ref(null)
const selectedDocument = ref(null)
const previewError = ref('')
const previewRenderKey = ref(0)

const baseUrl = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : (import.meta.env.VITE_APP_BASE_URL?.replace(/\/api\/?$/, '') || '')
const selectedPreviewUrl = computed(() => {
  if (!selectedDocument.value?.filePath) return ''
  const apiPrefix = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : '/api'
  return `${baseUrl}${apiPrefix}/file/${selectedDocument.value.filePath}`
})

const uploadDialogVisible = ref(false)
const uploadForm = ref({
  documentFile: null,
  documentName: ''
})

function syncSelectedDocument() {
  if (planDocuments.value.length === 0) {
    selectedDocument.value = null
    return
  }

  if (selectedDocument.value) {
    const matched = planDocuments.value.find(item => item.id === selectedDocument.value.id)
    if (matched) {
      selectedDocument.value = matched
      return
    }
  }

  selectedDocument.value = planDocuments.value.find(item => item.isCurrent) || planDocuments.value[0]
}

function selectDocument(doc) {
  selectedDocument.value = doc
  previewError.value = ''
  previewRenderKey.value += 1
}

async function fetchPlanDocuments() {
  try {
    loading.value = true
    error.value = null
    const response = await getPlanDocuments()
    if (response.code === 200) {
      planDocuments.value = response.data || []
      syncSelectedDocument()
    } else {
      throw new Error(response.message || '获取失败')
    }
  } catch (err) {
    error.value = '获取祭礼表失败，请稍后重试'
    ElMessage.error('获取祭礼表失败，请稍后重试')
    planDocuments.value = []
  } finally {
    loading.value = false
  }
}

async function handleUpload() {
  try {
    if (!uploadForm.value.documentFile) {
      ElMessage.error('请选择祭礼文书')
      return
    }
    if (!uploadForm.value.documentName.trim()) {
      ElMessage.error('请输入文书名称')
      return
    }

    const allowedTypes = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const allowedExtensions = ['.doc', '.docx']
    const fileExtension = uploadForm.value.documentFile.name.split('.').pop().toLowerCase()

    if (!allowedTypes.includes(uploadForm.value.documentFile.type) && !allowedExtensions.includes('.' + fileExtension)) {
      ElMessage.error('只支持祭礼文书格式（.doc, .docx）')
      return
    }

    const formData = new FormData()
    formData.append('document', uploadForm.value.documentFile)
    formData.append('title', uploadForm.value.documentName.trim())
    formData.append('is_current', '1')

    const response = await uploadPlanDocument(formData)
    if (response.code === 201) {
      // 根据权限显示不同消息：普通用户显示待审核，管理员显示已通过
      const message = response.data?.isReview === 0 
        ? '祭礼文书已奉纳，等待管理员审核' 
        : '祭礼文书奉纳成功'
      ElMessage.success(message)
      uploadDialogVisible.value = false
      
      await fetchPlanDocuments()
      
      uploadForm.value.documentFile = null
      uploadForm.value.documentName = ''
    } else {
      throw new Error(response.message || '奉纳失败')
    }
  } catch (err) {
    ElMessage.error('奉纳失败，请稍后重试')
  }
}

async function deleteDocument(doc) {
  try {
    await ElMessageBox.confirm(
      `确定要删除祭礼文书 "${doc.title}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await deletePlanDocument(doc.id)
    if (response.code === 200) {
      ElMessage.success('祭礼文书已删除')
      await fetchPlanDocuments()
    } else {
      throw new Error(response.message || '删除失败')
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败，请稍后重试')
    }
  }
}

async function setAsCurrent(doc) {
  try {
    const response = await setCurrentPlanDocument(doc.id)
    if (response.code === 200) {
      ElMessage.success('已设为当前祭礼')
      await fetchPlanDocuments()
    } else {
      throw new Error(response.message || '设置失败')
    }
  } catch (err) {
    ElMessage.error('设置失败，请稍后重试')
  }
}

function handleFileChange(file, fileList) {
  if (fileList.length > 0) {
    const selectedFile = file.raw || file
    uploadForm.value.documentFile = selectedFile
    
    if (!uploadForm.value.documentName) {
      uploadForm.value.documentName = selectedFile.name.replace(/\.[^/.]+$/, '')
    }
  } else {
    uploadForm.value.documentFile = null
    uploadForm.value.documentName = ''
  }
}

function handleFileExceed(files, fileList) {
  ElMessage.warning('只能选择一个祭礼文书，请先移除当前文书后再选择新的文书')
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function downloadDocument(doc) {
  if (!doc || !doc.filePath) return
  const apiPrefix = import.meta.env.VITE_APP_BASE_URL === '/api' ? '' : '/api'
  const url = `${baseUrl}${apiPrefix}/file/${doc.filePath}`
  const link = document.createElement('a')
  link.href = url
  link.download = doc.fileName || 'document.docx'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function onPreviewError(payload) {
  const detail = payload?.message ? `（${payload.message}）` : ''
  previewError.value = `当前祭礼暂不支持预览，请下载后查看${detail}`
}

function openUploadDialog() {
  uploadDialogVisible.value = true
  uploadForm.value.documentFile = null
  uploadForm.value.documentName = ''
}

onMounted(() => {
  fetchPlanDocuments()
})
</script>

<template>
  <div class="kamihome-plan-page">
    <div class="container">
      <!-- 神社风格页面头部 -->
      <section class="shrine-hero">
        <div class="hero-content">
          <h1 class="hero-title">
            <span class="hero-icon">🦊</span> 祭礼表 <span class="hero-icon">⛩️</span>
          </h1>
          <p class="hero-subtitle">奉纳祭礼仪轨，指引缘结之路</p>
        </div>
      </section>

      <!-- 控制卡片 -->
      <div class="controls-card kamihome-card">
        <div class="controls-main">
          <el-button v-if="isAuthenticated" @click="openUploadDialog" type="danger" class="kamihome-btn">
            <el-icon><UploadFilled /></el-icon>
            奉纳祭礼
          </el-button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-fox">
          <span class="fox-tail"></span>
          <span class="fox-tail"></span>
          <span class="fox-tail"></span>
        </div>
        <p>祭礼加载中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-empty description="缘结失败" :image-size="80">
          <template #image>
            <el-icon size="80" class="error-icon">
              <Warning />
            </el-icon>
          </template>
          <el-button @click="fetchPlanDocuments" type="danger" class="kamihome-btn">重新祈愿</el-button>
        </el-empty>
      </div>

      <!-- 空状态 -->
      <div v-else-if="planDocuments.length === 0" class="empty-state">
        <el-empty description="暂无祭礼文书" :image-size="80">
          <template #image>
            <el-icon size="80" class="empty-icon">
              <Document />
            </el-icon>
          </template>
          <template v-if="isAuthenticated" #default>
            <el-button type="danger" @click="openUploadDialog" class="kamihome-btn">
              <el-icon><UploadFilled /></el-icon>
              奉纳第一份祭礼
            </el-button>
          </template>
        </el-empty>
      </div>

      <!-- 文书网格与预览 -->
      <div v-else class="document-preview-page">
        <div class="document-grid">
          <div 
            v-for="doc in planDocuments" 
            :key="doc.id" 
            class="document-card kamihome-card"
            :class="{ 'current-document': doc.isCurrent, 'selected-document': selectedDocument?.id === doc.id }"
            @click="selectDocument(doc)"
          >
            <div class="card-header">
              <h3>{{ doc.title }}</h3>
              <el-tag v-if="doc.isCurrent" type="success" size="small">当前祭礼</el-tag>
            </div>
            <div class="card-body">
              <div class="document-info">
                <p class="file-name">{{ doc.fileName }}</p>
                <p class="upload-time">⏳ {{ formatTime(doc.uploadTime) }}</p>
              </div>
            </div>
            <div class="card-footer">
              <el-button @click.stop="downloadDocument(doc)" class="kamihome-btn small">
                <el-icon><Download /></el-icon>
                请回
              </el-button>
              <el-button 
                v-if="isAdmin && !doc.isCurrent" 
                @click.stop="setAsCurrent(doc)" 
                type="success" 
                class="kamihome-btn small"
              >
                设为当前
              </el-button>
              <el-button 
                v-if="isAuthenticated && doc.uploaderId === userStore.user?.id" 
                @click.stop="deleteDocument(doc)" 
                type="danger" 
                class="kamihome-btn small danger"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <!-- 底部预览面板 -->
        <div class="bottom-preview-panel kamihome-card">
          <div class="preview-panel-header">
            <h3>📜 祭礼预览</h3>
            <span v-if="selectedDocument">当前选中：{{ selectedDocument.fileName }}</span>
          </div>
          <div class="preview-panel-body">
            <el-empty v-if="!selectedDocument" description="请选择上方祭礼文书" :image-size="60" />
            <el-empty v-else-if="previewError" :description="previewError" :image-size="60" />
            <docx-preview
              v-else
              :key="`bottom-${previewRenderKey}`"
              :src="selectedPreviewUrl"
              style="height: 100%"
              @error="onPreviewError"
            />
          </div>
        </div>
      </div>

      <!-- 奉纳对话框 -->
      <el-dialog v-model="uploadDialogVisible" title="🎴 奉纳祭礼" width="600px" :close-on-click-modal="false" custom-class="kamihome-dialog">
        <el-form :model="uploadForm">
          <el-form-item>
            <el-upload 
              :on-change="handleFileChange" 
              :auto-upload="false"
              :show-file-list="true" 
              accept=".doc,.docx" 
              action="" 
              drag 
              :limit="1"
              :on-exceed="handleFileExceed" 
              style="width: 100%;"
            >
              <el-icon class="el-icon--upload">
                <UploadFilled />
              </el-icon>
              <div class="el-upload__text">
                将祭礼文书拖到此处，或 <em>点击选择</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只支持祭礼文书格式（.doc, .docx）
                </div>
              </template>
            </el-upload>
          </el-form-item>

          <el-form-item label="文书名称">
            <el-input v-model="uploadForm.documentName" placeholder="请输入文书名称" maxlength="50" show-word-limit />
          </el-form-item>
        </el-form>

        <template #footer>
          <span class="dialog-footer">
            <el-button @click="uploadDialogVisible = false" class="kamihome-btn">取消</el-button>
            <el-button type="danger" @click="handleUpload" class="kamihome-btn">
              奉纳
            </el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-plan-page {
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

.container {
  max-width: 1600px;
  margin: 0 auto;
}

/* 神社头部 */
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

/* 卡片样式 */
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
  padding: 4px 12px;
  font-size: 13px;
}

.kamihome-btn.danger {
  background: #f0d8c0;
  color: #9b2a1a;
}

/* 控制卡片 */
.controls-card {
  padding: 20px 24px;
  margin-bottom: 24px;
}

.controls-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px;
  color: #5e2c1a;
}

.loading-fox {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
}

.fox-tail {
  width: 8px;
  height: 24px;
  background: #c33a2b;
  border-radius: 4px;
  animation: foxSway 1.2s infinite ease-in-out;
}

.fox-tail:nth-child(1) { animation-delay: 0s; }
.fox-tail:nth-child(2) { animation-delay: 0.15s; }
.fox-tail:nth-child(3) { animation-delay: 0.3s; }

@keyframes foxSway {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}

/* 文书网格 */
.document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.document-preview-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.document-card {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.document-card.current-document {
  border-color: #67c23a;
  background: linear-gradient(135deg, #f0f9eb 0%, rgba(255, 250, 240, 0.9) 100%);
}

.document-card.selected-document {
  border-color: #c33a2b;
  box-shadow: 0 0 0 2px rgba(200, 60, 40, 0.3), 0 5px 0 #9b2a1a;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 2px dashed #c33a2b;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  color: #5e2c1a;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.card-body {
  padding: 20px;
  flex: 1;
}

.document-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-name {
  margin: 0;
  font-size: 14px;
  color: #3a2214;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-time {
  margin: 0;
  font-size: 12px;
  color: #7a3a28;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px dashed #c33a2b;
}

/* 底部预览面板 */
.bottom-preview-panel {
  padding: 0 !important;
  overflow: hidden;
}

.preview-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 2px dashed #c33a2b;
  background: rgba(245, 230, 211, 0.3);
}

.preview-panel-header h3 {
  margin: 0;
  color: #5e2c1a;
  font-size: 16px;
  font-weight: 700;
}

.preview-panel-header span {
  color: #7a3a28;
  font-size: 12px;
}

.preview-panel-body {
  height: 420px;
  padding: 12px;
  background: #fef7f0;
}

/* 空状态与错误状态 */
.empty-state,
.error-state {
  padding: 60px 20px;
  text-align: center;
}

.empty-icon,
.error-icon {
  color: #c33a2b;
}

/* 对话框 */
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

/* 响应式 */
@media (max-width: 768px) {
  .kamihome-plan-page {
    padding: 16px;
  }

  .shrine-hero {
    padding: 30px 16px;
  }

  .hero-title {
    font-size: 2rem;
  }

  .document-grid {
    grid-template-columns: 1fr;
  }

  .preview-panel-body {
    height: 360px;
  }

  .card-footer {
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 1.6rem;
  }

  .kamihome-btn {
    padding: 6px 14px;
    font-size: 13px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>