<template>
  <div class="kamihome-user-center">
    <div class="container">
      <!-- 左侧信息卡片 -->
      <div class="info-card kamihome-card">
        <div class="avatar-section">
          <Avatar :src="userInfo.avatar" width="100" height="100" class="user-avatar" />
          <div class="avatar-buttons">
            <el-button type="primary" plain size="small" @click="updateFromBilibili" :loading="updatingAvatar" class="kamihome-btn small">
              小破站头像
            </el-button>
          </div>
          <div class="avatar-tip">⛩️ 点击同步B站御姿</div>
        </div>
        <div class="user-basic">
          <h2 class="user-name">{{ userInfo.name }}</h2>
          <div class="badge-container">
            <UserBadge :level="userInfo.medal_level || 0" :badge="userInfo.badge || '未上供'" />
          </div>
          <p class="info-line"><span class="info-label">🆔 B站UID：</span>{{ userInfo.bilibili_uid || '未绑定' }}</p>
          <p class="info-line"><span class="info-label">📧 邮箱：</span>{{ userInfo.email || '未绑定' }}</p>
          <p class="info-line">
            <span class="info-label">🎴 身份：</span>
            <el-tag :type="permissionType" size="small">{{ permissionLabel }}</el-tag>
            <span v-if="userInfo.custom_tag" class="custom-tag">✨ {{ userInfo.custom_tag }}</span>
          </p>
          <p class="info-line"><span class="info-label">📅 注册：</span>{{ formatTime(userInfo.create_time) }}</p>
          <p class="info-line"><span class="info-label">🙏 参拜日数：</span>{{ userInfo.checkin_days || 0 }} 日</p>
          <p class="info-line"><span class="info-label">🎴 绘马数：</span>{{ userInfo.post_count || 0 }} 枚</p>
          <el-button type="danger" plain @click="logout" class="kamihome-btn logout-btn">退社</el-button>
        </div>
      </div>

      <!-- 右侧编辑区域 -->
      <div class="edit-card kamihome-card">
        <el-tabs v-model="activeTab" class="kamihome-tabs">
          <el-tab-pane label="修改神谕" name="password">
            <el-form :model="passwordForm" label-width="80px" class="kamihome-form">
              <el-form-item label="原神谕">
                <el-input type="password" v-model="passwordForm.oldPassword" placeholder="请输入原密码" />
              </el-form-item>
              <el-form-item label="新神谕">
                <el-input type="password" v-model="passwordForm.newPassword" placeholder="至少6位" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="changePassword" class="kamihome-btn">修改神谕</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="我的绘马" name="posts">
            <div class="post-list">
              <div v-for="post in myPosts" :key="post.id" class="post-item">
                <div class="post-content" v-html="post.content"></div>
                <div class="post-meta">
                  <span>📅 {{ formatTime(post.created_at) }}</span>
                  <span>❤️ {{ post.like_count }}</span>
                  <span>💬 {{ post.comment_count }}</span>
                  <span>🖼️ {{ post.image_count }}</span>
                </div>
              </div>
              <el-pagination
                v-if="postTotal > postPageSize"
                background
                layout="prev, pager, next"
                :total="postTotal"
                :page-size="postPageSize"
                :current-page="postPage"
                @current-change="loadPosts"
                class="kamihome-pagination"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="我的祝词" name="comments">
            <div class="comment-list">
              <div v-for="comment in myComments" :key="comment.id" class="comment-item">
                <div class="comment-content" v-html="comment.content"></div>
                <div class="comment-meta">
                  <span>回复绘马：{{ truncate(comment.post_content, 50) }}</span>
                  <span>📅 {{ formatTime(comment.created_at) }}</span>
                </div>
              </div>
              <el-pagination
                v-if="commentTotal > commentPageSize"
                background
                layout="prev, pager, next"
                :total="commentTotal"
                :page-size="commentPageSize"
                :current-page="commentPage"
                @current-change="loadComments"
                class="kamihome-pagination"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import UserBadge from '@/components/UserBadge.vue'
import Avatar from '@/components/Avatar.vue'

const router = useRouter()
const userStore = useUserStore()
const token = localStorage.getItem('oi_token')

const userInfo = ref({
  name: '',
  account_number: '',
  email: '',
  permission: 3,
  avatar: '',
  bilibili_uid: '',
  bilibili_name: '',
  badge: '',
  medal_level: 0,
  custom_tag: '',
  create_time: 0,
  checkin_days: 0,
  post_count: 0
})

const passwordForm = ref({ oldPassword: '', newPassword: '' })
const activeTab = ref('password')

const myPosts = ref([])
const postPage = ref(1)
const postPageSize = 10
const postTotal = ref(0)

const myComments = ref([])
const commentPage = ref(1)
const commentPageSize = 10
const commentTotal = ref(0)

const updatingAvatar = ref(false)

const permissionLabel = computed(() => {
  switch (userInfo.value.permission) {
    case 0: return '大神主'
    case 1: return '神主'
    case 2: return '神官'
    default: return '黛言人'
  }
})
const permissionType = computed(() => {
  switch (userInfo.value.permission) {
    case 0: return 'danger'
    case 1: return 'danger'
    case 2: return 'warning'
    default: return 'primary'
  }
})

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`
}

const truncate = (str, len) => {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    const res = await axios.get('/api/user/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    userInfo.value = res.data
  } catch (err) {
    ElMessage.error('获取黛言人信息失败')
  }
}

// 从B站同步头像（小破站头像）
const updateFromBilibili = async () => {
  const uid = userInfo.value.bilibili_uid
  if (!uid) {
    ElMessage.warning('您尚未绑定B站UID，无法获取御姿')
    return
  }
  updatingAvatar.value = true
  try {
    const res = await axios.post('/api/user/update-avatar', { bilibili_uid: uid }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.data.success) {
      userInfo.value.avatar = res.data.avatar
      userStore.setAvatar(res.data.avatar)
      ElMessage.success('御姿已同步')
    } else {
      ElMessage.error(res.data.error || '同步失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '缘结失败，请稍后再试')
  } finally {
    updatingAvatar.value = false
  }
}

// 修改密码
const changePassword = async () => {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) {
    return ElMessage.warning('请填写完整的神谕')
  }
  if (passwordForm.value.newPassword.length < 6) {
    return ElMessage.warning('新神谕至少6位')
  }
  try {
    await axios.put('/api/user/me/password', passwordForm.value, {
      headers: { Authorization: `Bearer ${token}` }
    })
    ElMessage.success('神谕已修改，请重新参拜')
    setTimeout(() => {
      logout()
    }, 1500)
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '修改失败')
  }
}

// 加载我的动态（绘马）
const loadPosts = async (page = 1) => {
  try {
    const res = await axios.get(`/api/user/me/posts?page=${page}&pageSize=${postPageSize}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    myPosts.value = res.data.data
    postTotal.value = res.data.total
    postPage.value = res.data.page
  } catch (err) {
    ElMessage.error('加载绘马失败')
  }
}

// 加载我的评论（祝词）
const loadComments = async (page = 1) => {
  try {
    const res = await axios.get(`/api/user/me/comments?page=${page}&pageSize=${commentPageSize}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    myComments.value = res.data.data
    commentTotal.value = res.data.total
    commentPage.value = res.data.page
  } catch (err) {
    ElMessage.error('加载祝词失败')
  }
}

// 退出登录
const logout = async () => {
  try {
    await ElMessageBox.confirm('确定要退社吗？', '退社确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    })
    // 清除所有本地存储的会话信息
    localStorage.removeItem('oi_token')
    sessionStorage.clear()
    userStore.logout()
    ElMessage.success('已退社')
    // 跳转到主页并强制刷新
    window.location.href = '/'
  } catch {
    // 用户取消操作
  }
}

onMounted(() => {
  fetchUserInfo()
  loadPosts()
  loadComments()
})
</script>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-user-center {
  min-height: 100vh;
  background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
  padding: 24px;
  box-sizing: border-box;
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
  overflow-x: hidden;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
}

/* ==================== 和风卡片 ==================== */
.kamihome-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(5px);
  border: 2px solid #c33a2b;
  border-radius: 16px 16px 16px 6px;
  box-shadow: 0 5px 0 #9b2a1a, 0 8px 16px rgba(160, 60, 40, 0.1);
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
  padding: 24px 20px;
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

.info-card {
  flex: 1;
  min-width: 280px;
  text-align: center;
}

.edit-card {
  flex: 2;
  min-width: 400px;
}

/* ==================== 按钮样式 ==================== */
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
  white-space: nowrap;
}

.kamihome-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a;
  background: #fce4d6;
}

.kamihome-btn.small {
  padding: 4px 14px;
  font-size: 13px;
}

.logout-btn {
  margin-top: 16px;
  width: 100%;
  justify-content: center;
}

/* ==================== 头像区域 ==================== */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px dashed #c33a2b;
}

.user-avatar {
  border-radius: 50%;
  border: 3px solid #c33a2b;
  box-shadow: 0 4px 0 #9b2a1a;
  object-fit: cover;
}

.avatar-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.avatar-tip {
  font-size: 12px;
  color: #7a3a28;
  font-style: italic;
}

/* ==================== 用户基本信息 ==================== */
.user-name {
  font-size: 28px;
  font-weight: 700;
  color: #5e2c1a;
  margin: 0 0 8px;
  text-shadow: 2px 2px 0 #f0d8c0;
}

.badge-container {
  display: flex;
  justify-content: center;
  margin: 12px 0;
}

.info-line {
  margin: 10px 0;
  color: #3a2214;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 5px;
}

.info-label {
  font-weight: 700;
  color: #7a3a28;
}

.custom-tag {
  margin-left: 8px;
  background: #fce4d6;
  border: 1px solid #c33a2b;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  color: #a03820;
}

/* ==================== 标签页样式 ==================== */
.kamihome-tabs :deep(.el-tabs__header) {
  border-bottom: 2px solid #c33a2b;
  margin-bottom: 20px;
}

.kamihome-tabs :deep(.el-tabs__item) {
  color: #5e2c1a;
  font-weight: 600;
}

.kamihome-tabs :deep(.el-tabs__item.is-active) {
  color: #c33a2b;
}

.kamihome-tabs :deep(.el-tabs__active-bar) {
  background-color: #c33a2b;
}

/* ==================== 表单样式 ==================== */
.kamihome-form :deep(.el-form-item__label) {
  color: #5e2c1a;
  font-weight: 600;
}

.kamihome-form :deep(.el-input__wrapper) {
  background: #fef7f0;
  border: 1.5px solid #c33a2b;
  border-radius: 20px;
  box-shadow: none;
}

.kamihome-form :deep(.el-input__wrapper:hover) {
  border-color: #a03820;
}

/* ==================== 动态与评论列表 ==================== */
.post-item, .comment-item {
  border-bottom: 1px dashed #c33a2b;
  padding: 16px 0;
}

.post-item:last-child, .comment-item:last-child {
  border-bottom: none;
}

.post-content, .comment-content {
  color: #3a2214;
  line-height: 1.5;
}

.post-meta, .comment-meta {
  font-size: 13px;
  color: #7a3a28;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

/* ==================== 分页样式 ==================== */
.kamihome-pagination {
  margin-top: 24px;
  justify-content: center;
}

.kamihome-pagination :deep(.el-pager li) {
  background: #f5e6d3 !important;
  border: 1.5px solid #c33a2b !important;
  color: #5e2c1a !important;
  font-weight: 600;
  box-shadow: 0 2px 0 #9b2a1a;
}

.kamihome-pagination :deep(.el-pager li.active) {
  background: #c33a2b !important;
  color: #fff5e0 !important;
}

.kamihome-pagination :deep(.btn-prev),
.kamihome-pagination :deep(.btn-next) {
  background: #f5e6d3 !important;
  border: 1.5px solid #c33a2b !important;
  color: #5e2c1a !important;
  box-shadow: 0 2px 0 #9b2a1a;
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .kamihome-user-center {
    padding: 16px;
  }
  .container {
    flex-direction: column;
    gap: 20px;
  }
  .edit-card {
    min-width: auto;
  }
  .info-line {
    justify-content: flex-start;
    padding-left: 10px;
  }
}

@media (max-width: 480px) {
  .kamihome-user-center {
    padding: 12px;
  }
  .kamihome-card {
    padding: 16px 12px;
  }
  .user-name {
    font-size: 24px;
  }
  .info-line {
    font-size: 14px;
  }
  .kamihome-btn {
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>