<script setup>
import { ref, computed, onMounted } from 'vue'
import { Bell, Clock, User, Star, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/api/announcement.js'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'

// 用户状态
const userStore = useUserStore()
const { permission } = storeToRefs(userStore)

// 判断是否为管理员（大神主/神主/神官）
const isAdmin = computed(() => {
    return permission.value <= 2
})

// 公告数据
const announcements = ref([])
const loading = ref(false)

// 获取公告列表
const fetchAnnouncements = async () => {
    loading.value = true
    try {
        const result = await getAnnouncements()
        if (result && result.code === 200 && Array.isArray(result.data)) {
            announcements.value = result.data
        } else {
            ElMessage.error(result?.message || '获取神託失败')
        }
    } catch (error) {
        console.error('获取神託失败:', error)
        ElMessage.error('获取神託失败，请稍后重试')
    } finally {
        loading.value = false
    }
}

// 页面加载时获取公告列表
onMounted(() => {
    fetchAnnouncements()
})

// 展开的公告ID集合
const expandedAnnouncements = ref(new Set())

// 切换公告展开状态
const toggleExpanded = (announcementId) => {
    if (expandedAnnouncements.value.has(announcementId)) {
        expandedAnnouncements.value.delete(announcementId)
    } else {
        expandedAnnouncements.value.add(announcementId)
    }
}

// 检查公告是否展开
const isExpanded = (announcementId) => {
    return expandedAnnouncements.value.has(announcementId)
}

// 判断公告内容是否需要折叠（HTML字符数超过300）
const shouldCollapse = (content) => {
    if (!content) return false
    return content.length > 300
}

// 获取折叠显示的内容（截取前200个字符）
const getCollapsedContent = (content) => {
    if (!content) return ''
    return content.substring(0, 200) + '...'
}

// 获取神託类型标签
const getCategoryLabel = (category) => {
    const labels = {
        system: '神社神託',
        feature: '新缘启示',
        update: '祭礼更新',
        holiday: '缘结修复'
    }
    return labels[category] || '神託'
}

// 获取神託类型颜色
const getCategoryColor = (category) => {
    const colors = {
        system: '#c33a2b',
        feature: '#a03820',
        update: '#d44c3a',
        holiday: '#8a6e5a'
    }
    return colors[category] || '#9b2a1a'
}

// 置顶神託排序
const sortedAnnouncements = computed(() => {
    return [...announcements.value].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return new Date(b.publishTime) - new Date(a.publishTime)
    })
})

// 神託表单对话框
const dialogVisible = ref(false)
const dialogTitle = ref('奉纳神託')
const isEdit = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const form = ref({
    title: '',
    content: '',
    author: '',
    isPinned: false,
    category: 'system'
})

// 表单验证规则
const formRules = {
    title: [
        { required: true, message: '请输入神託标题', trigger: 'blur' },
        { min: 1, max: 100, message: '标题长度应在1-100个字符', trigger: 'blur' }
    ],
    content: [
        { required: true, message: '请输入神託内容', trigger: 'blur' }
    ]
}

// 分类选项
const categoryOptions = [
    { label: '神社神託', value: 'system' },
    { label: '新缘启示', value: 'feature' },
    { label: '祭礼更新', value: 'update' },
    { label: '缘结修复', value: 'holiday' }
]

// 打开创建对话框
const openCreateDialog = () => {
    isEdit.value = false
    editingId.value = null
    dialogTitle.value = '奉纳神託'
    form.value = {
        title: '',
        content: '',
        author: userStore.username || '神主',
        isPinned: false,
        category: 'system'
    }
    dialogVisible.value = true
}

// 打开编辑对话框
const openEditDialog = (announcement) => {
    isEdit.value = true
    editingId.value = announcement.id
    dialogTitle.value = '编辑神託'
    form.value = {
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        isPinned: announcement.isPinned,
        category: announcement.category
    }
    dialogVisible.value = true
}

// 提交表单
const submitForm = async () => {
    if (!formRef.value) return

    await formRef.value.validate(async (valid) => {
        if (valid) {
            try {
                if (isEdit.value) {
                    const result = await updateAnnouncement(editingId.value, form.value)
                    if (result && result.code === 200) {
                        ElMessage.success('神託更新成功')
                        dialogVisible.value = false
                        fetchAnnouncements()
                    } else {
                        ElMessage.error(result?.message || '更新失败')
                    }
                } else {
                    const result = await createAnnouncement(form.value)
                    if (result && result.code === 200) {
                        ElMessage.success('神託奉纳成功')
                        dialogVisible.value = false
                        fetchAnnouncements()
                    } else {
                        ElMessage.error(result?.message || '奉纳失败')
                    }
                }
            } catch (error) {
                console.error('提交失败:', error)
                ElMessage.error('操作失败，请稍后重试')
            }
        }
    })
}

// 删除神託
const handleDelete = (announcement) => {
    ElMessageBox.confirm(
        `确定要删除神託 "${announcement.title}" 吗？`,
        '确认删除',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }
    ).then(async () => {
        try {
            const result = await deleteAnnouncement(announcement.id)
            if (result && result.code === 200) {
                ElMessage.success('神託已删除')
                fetchAnnouncements()
            } else {
                ElMessage.error(result?.message || '删除失败')
            }
        } catch (error) {
            console.error('删除失败:', error)
            ElMessage.error('删除失败，请稍后重试')
        }
    }).catch(() => {})
}
</script>

<template>
    <div class="kamihome-announcement-page">
        <div class="content-wrapper">
            <!-- 神社风格页面头部 -->
            <section class="shrine-hero">
                <div class="hero-content">
                    <h1 class="hero-title">
                        <span class="hero-icon">🦊</span> 神託所 <span class="hero-icon">⛩️</span>
                    </h1>
                    <p class="hero-subtitle">聆听神谕，共赴缘结之旅</p>
                </div>
            </section>

            <!-- 神託列表 -->
            <div class="announcement-section kamihome-card">
                <!-- 神官工具栏 -->
                <div v-if="isAdmin" class="admin-toolbar">
                    <el-button type="danger" :icon="Plus" @click="openCreateDialog" class="kamihome-btn">
                        奉纳神託
                    </el-button>
                </div>

                <!-- 加载状态 -->
                <div v-if="loading" class="loading-state">
                    <div class="loading-fox">
                        <span class="fox-tail"></span>
                        <span class="fox-tail"></span>
                        <span class="fox-tail"></span>
                    </div>
                    <p>神託加载中...</p>
                </div>

                <!-- 神託列表 -->
                <div v-else class="announcement-list">
                    <div v-for="announcement in sortedAnnouncements" :key="announcement.id" class="announcement-card"
                        :class="{ 'pinned': announcement.isPinned }">

                        <!-- 神託头部 -->
                        <div class="announcement-header">
                            <div class="header-left">
                                <div v-if="announcement.isPinned" class="pinned-badge">
                                    <el-icon><Star /></el-icon>
                                    置顶神託
                                </div>
                                <el-tag :color="getCategoryColor(announcement.category)" size="small" effect="dark">
                                    {{ getCategoryLabel(announcement.category) }}
                                </el-tag>
                            </div>
                            <div class="header-right">
                                <span class="publish-time">
                                    <el-icon><Clock /></el-icon>
                                    {{ announcement.publishTime }}
                                </span>
                            </div>
                        </div>

                        <!-- 神託标题 -->
                        <h3 class="announcement-title">{{ announcement.title }}</h3>

                        <!-- 神託内容 -->
                        <div class="announcement-content">
                            <div v-if="!isExpanded(announcement.id) && shouldCollapse(announcement.content)"
                                class="content-collapsed">
                                <div class="content-html" v-html="getCollapsedContent(announcement.content)"></div>
                                <div class="expand-indicator">
                                    <el-button size="small" text @click="toggleExpanded(announcement.id)"
                                        class="expand-btn kamihome-btn small">
                                        展开全文
                                    </el-button>
                                </div>
                            </div>

                            <div v-else class="content-expanded">
                                <div class="content-html" v-html="announcement.content"></div>
                                <div v-if="shouldCollapse(announcement.content)" class="collapse-indicator">
                                    <el-button size="small" text @click="toggleExpanded(announcement.id)"
                                        class="collapse-btn kamihome-btn small">
                                        收起内容
                                    </el-button>
                                </div>
                            </div>
                        </div>

                        <!-- 神託底部 -->
                        <div class="announcement-footer">
                            <div class="author-info">
                                <el-icon><User /></el-icon>
                                <span>{{ announcement.author }}</span>
                            </div>
                            <!-- 神官操作按钮 -->
                            <div v-if="isAdmin" class="admin-actions">
                                <el-button size="small" type="primary" :icon="Edit" @click="openEditDialog(announcement)" class="kamihome-btn small">
                                    编辑
                                </el-button>
                                <el-button size="small" type="danger" :icon="Delete" @click="handleDelete(announcement)" class="kamihome-btn small danger">
                                    删除
                                </el-button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 空状态 -->
                <div v-if="!loading && announcements.length === 0" class="empty-state">
                    <el-empty description="暂无神託" :image-size="80">
                        <template #image>
                            <el-icon size="80" class="empty-icon">
                                <Bell />
                            </el-icon>
                        </template>
                    </el-empty>
                </div>
            </div>
        </div>

        <!-- 奉纳/编辑神託对话框 -->
        <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px" destroy-on-close custom-class="kamihome-dialog">
            <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
                <el-form-item label="标题" prop="title">
                    <el-input v-model="form.title" placeholder="请输入神託标题" maxlength="100" show-word-limit />
                </el-form-item>
                <el-form-item label="神主">
                    <el-input v-model="form.author" placeholder="请输入神主名称" />
                </el-form-item>
                <el-form-item label="分类">
                    <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
                        <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label"
                            :value="item.value" />
                    </el-select>
                </el-form-item>
                <el-form-item label="置顶">
                    <el-switch v-model="form.isPinned" />
                </el-form-item>
                <el-form-item label="内容" prop="content">
                    <el-input v-model="form.content" type="textarea" :rows="10" placeholder="请输入神託内容，支持HTML格式" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false" class="kamihome-btn">取消</el-button>
                <el-button type="danger" @click="submitForm" class="kamihome-btn">奉纳</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-announcement-page {
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
    max-width: 1200px;
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
    padding: 30px;
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

/* 神託区域 */
.announcement-section {
    margin-top: 20px;
}

/* 神官工具栏 */
.admin-toolbar {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px dashed #c33a2b;
}

/* 加载状态 */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
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

.announcement-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.announcement-card {
    border: 1.5px solid #c33a2b;
    border-radius: 16px;
    padding: 24px;
    background: rgba(255, 250, 240, 0.5);
    box-shadow: 0 3px 0 #9b2a1a;
    transition: all 0.2s ease;
}

.announcement-card:hover {
    border-color: #a03820;
    box-shadow: 0 5px 0 #9b2a1a;
    background: #fce4d6;
    transform: translateY(-2px);
}

.announcement-card.pinned {
    border-color: #e6a23c;
    background: linear-gradient(135deg, #fdf6ec 0%, #fce4d6 100%);
    box-shadow: 0 4px 0 #c33a2b;
}

/* 神託头部 */
.announcement-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 10px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.pinned-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #c33a2b;
    color: #fff5e0;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid #fff5e0;
}

.header-right {
    display: flex;
    align-items: center;
}

.publish-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #7a3a28;
}

/* 神託标题 */
.announcement-title {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 700;
    color: #5e2c1a;
}

/* 神託内容 */
.announcement-content {
    color: #3a2214;
    line-height: 1.6;
    margin-bottom: 20px;
}

.content-html {
    line-height: 1.6;
}

.content-html h4 {
    color: #c33a2b;
    font-size: 16px;
    font-weight: 600;
    margin: 20px 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #c33a2b;
}

.expand-indicator,
.collapse-indicator {
    margin-top: 8px;
    text-align: center;
}

/* 神託底部 */
.announcement-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px dashed #c33a2b;
    flex-wrap: wrap;
    gap: 10px;
}

.author-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #7a3a28;
}

.admin-actions {
    display: flex;
    gap: 8px;
}

/* 空状态 */
.empty-state {
    text-align: center;
    padding: 60px 20px;
}

.empty-icon {
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

/* 响应式 */
@media (max-width: 768px) {
    .kamihome-announcement-page {
        padding: 16px;
    }
    .shrine-hero {
        padding: 30px 16px;
    }
    .hero-title {
        font-size: 2rem;
    }
    .kamihome-card {
        padding: 20px;
    }
    .announcement-card {
        padding: 20px;
    }
    .announcement-header {
        flex-direction: column;
        align-items: flex-start;
    }
    .header-right {
        align-self: flex-end;
    }
    .announcement-footer {
        flex-direction: column;
        align-items: flex-start;
    }
    .admin-actions {
        width: 100%;
        justify-content: flex-end;
    }
}

@media (max-width: 480px) {
    .kamihome-announcement-page {
        padding: 12px;
    }
    .hero-title {
        font-size: 1.6rem;
    }
    .kamihome-card {
        padding: 16px;
    }
    .announcement-card {
        padding: 16px;
    }
    .announcement-title {
        font-size: 16px;
    }
}
</style>