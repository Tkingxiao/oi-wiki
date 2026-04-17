<template>
  <div class="kamihome-checkin-page">
    <div class="container">
      <!-- 左侧：参拜排行榜 -->
      <div class="rank-section kamihome-card">
        <h2 class="section-title">
          <span class="title-icon">🦊</span> 参拜排行榜 <span class="title-icon">⛩️</span>
        </h2>
        <!-- 桌面端表格 -->
        <div class="desktop-table">
          <div class="table-wrapper">
            <el-table :data="paginatedRankList" stripe class="rank-table">
              <el-table-column type="index" label="顺位" width="70">
                <template #default="scope">
                  <span class="rank-index" :class="{ 'top-three': scope.$index < 3 }">
                    {{ (rankCurrentPage - 1) * rankPageSize + scope.$index + 1 }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="御姿" width="70">
                <template #default="scope">
                  <Avatar :src="scope.row.avatar || ''" width="40" height="40" class="rank-avatar" />
                </template>
              </el-table-column>
              <el-table-column label="氏子" min-width="160">
                <template #default="scope">
                  <div class="user-rank-info">
                    <span class="user-name">{{ scope.row.name }}</span>
                    <UserBadge :level="scope.row.medal_level || 0" :badge="scope.row.badge || '未上供'" />
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="days" label="参拜日数" sortable width="90">
                <template #default="scope">
                  <span class="days-badge">{{ scope.row.days }} 日</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <!-- 手机端卡片列表 -->
        <div class="mobile-rank-list">
          <div v-for="(user, idx) in paginatedRankList" :key="user.id" class="rank-card">
            <div class="rank-card-header">
              <div class="rank-number" :class="{ 'top-three': (rankCurrentPage - 1) * rankPageSize + idx < 3 }">
                #{{ (rankCurrentPage - 1) * rankPageSize + idx + 1 }}
              </div>
              <Avatar :src="user.avatar || ''" width="44" height="44" class="mobile-avatar" />
              <div class="rank-user-info">
                <div class="rank-user-name">{{ user.name }}</div>
                <UserBadge :level="user.medal_level || 0" :badge="user.badge || '未上供'" />
              </div>
              <div class="rank-days">{{ user.days }} 日</div>
            </div>
          </div>
        </div>
        <div class="pagination-container" v-if="rankList.length > rankPageSize">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="rankList.length"
            :page-size="rankPageSize"
            :current-page="rankCurrentPage"
            @current-change="handleRankPageChange"
            class="kamihome-pagination"
          />
        </div>
      </div>

      <!-- 右侧：今日绘马墙 -->
      <div class="messages-section kamihome-card">
        <h2 class="section-title">
          <span class="title-icon">🎴</span> 今日绘马墙 <span class="title-icon">🌸</span>
        </h2>
        <div class="messages-list">
          <div v-for="msg in paginatedMessages" :key="msg.id" class="message-card">
            <div class="user-info">
              <Avatar :src="msg.avatar || ''" width="36" height="36" class="msg-avatar" />
              <span class="name">{{ msg.name }}</span>
              <span class="mood-badge">{{ getMoodEmoji(msg.mood) }}</span>
            </div>
            <div class="message-text">{{ msg.message || '今日默默参拜～' }}</div>
            <div class="time">⏳ {{ formatTime(msg.created_at) }}</div>
          </div>
          <div v-if="messages.length === 0" class="empty-tip">
            <span class="empty-icon">🦊</span>
            <p>今日尚无绘马，快来挂上第一个心愿吧！</p>
          </div>
        </div>
        <div class="pagination-container" v-if="messages.length > messagePageSize">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="messages.length"
            :page-size="messagePageSize"
            :current-page="messageCurrentPage"
            @current-change="handleMessagePageChange"
            class="kamihome-pagination"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import UserBadge from '@/components/UserBadge.vue'

const rankList = ref([])
const messages = ref([])

const rankCurrentPage = ref(1)
const rankPageSize = 8
const messageCurrentPage = ref(1)
const messagePageSize = 8

const paginatedRankList = computed(() => {
  const start = (rankCurrentPage.value - 1) * rankPageSize
  const end = start + rankPageSize
  return rankList.value.slice(start, end)
})

const paginatedMessages = computed(() => {
  const start = (messageCurrentPage.value - 1) * messagePageSize
  const end = start + messagePageSize
  return messages.value.slice(start, end)
})

const handleRankPageChange = (page) => { rankCurrentPage.value = page }
const handleMessagePageChange = (page) => { messageCurrentPage.value = page }

const moodMap = { happy: '😊', excited: '🎉', tired: '😴', struggle: '💪', sad: '😢' }
const getMoodEmoji = (mood) => moodMap[mood] || '😊'

const formatTime = (timestamp) => {
  const date = new Date(timestamp * 1000)
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

const fetchData = async () => {
  try {
    const token = localStorage.getItem('oi_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const [rankRes, msgRes] = await Promise.all([
      axios.get('/api/checkin/rank', { headers }),
      axios.get('/api/checkin/messages', { headers })
    ])
    rankList.value = rankRes.data
    messages.value = msgRes.data
    rankCurrentPage.value = 1
    messageCurrentPage.value = 1
  } catch (err) {
    console.error('获取数据失败：', err)
  }
}

onMounted(() => { fetchData() })
</script>

<style scoped>
.kamihome-checkin-page {
  padding: 24px;
  min-height: 100vh;
  background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
  width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
}

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

.rank-section, .messages-section {
  flex: 1;
  min-width: 280px;
  padding: 24px 20px;
  box-sizing: border-box;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #5e2c1a;
  text-align: center;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 3px dashed #c33a2b;
  text-shadow: 2px 2px 0 #f0d8c0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.title-icon {
  font-size: 26px;
}

.desktop-table {
  display: block;
}

.table-wrapper {
  overflow-x: auto;
  width: 100%;
}

.rank-table {
  min-width: 480px;
}

.rank-table :deep(.el-table__header) th {
  background-color: #f5e6d3 !important;
  color: #5e2c1a !important;
  font-weight: 700;
  border-bottom: 2px solid #c33a2b !important;
}

.rank-table :deep(.el-table__body) tr {
  background-color: rgba(255, 250, 240, 0.5) !important;
}

.rank-table :deep(.el-table__body) tr:hover > td {
  background-color: #fce4d6 !important;
}

.rank-table :deep(.el-table__row--striped) td {
  background-color: rgba(245, 230, 211, 0.4) !important;
}

.rank-index {
  font-weight: 700;
  color: #7a3a28;
}

.rank-index.top-three {
  color: #c33a2b;
  font-size: 16px;
  text-shadow: 0 0 3px #ffd700;
}

.rank-avatar {
  border-radius: 50%;
  border: 2px solid #c33a2b;
  box-shadow: 0 2px 0 #9b2a1a;
  object-fit: cover;
}

.user-rank-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.user-name {
  font-weight: 600;
  color: #3a2214;
}

.days-badge {
  background: #c33a2b;
  color: #fff5e0;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 2px 0 #9b2a1a;
  display: inline-block;
}

.mobile-rank-list {
  display: none;
}

.rank-card {
  background: rgba(245, 230, 211, 0.6);
  border: 1.5px solid #c33a2b;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
  box-shadow: 0 3px 0 #9b2a1a;
  transition: all 0.15s;
}

.rank-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a;
  background: #fce4d6;
}

.rank-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rank-number {
  font-weight: 800;
  font-size: 18px;
  color: #7a3a28;
  min-width: 45px;
}

.rank-number.top-three {
  color: #c33a2b;
  text-shadow: 0 0 5px #ffd700;
}

.mobile-avatar {
  border-radius: 50%;
  border: 2px solid #c33a2b;
  box-shadow: 0 2px 0 #9b2a1a;
}

.rank-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rank-user-name {
  font-weight: 700;
  font-size: 15px;
  color: #3a2214;
}

.rank-days {
  font-weight: 700;
  background: #c33a2b;
  color: #fff5e0;
  padding: 6px 12px;
  border-radius: 30px;
  font-size: 14px;
  box-shadow: 0 2px 0 #9b2a1a;
  white-space: nowrap;
}

.messages-list {
  max-height: 600px;
  overflow-y: auto;
  width: 100%;
  padding-right: 4px;
}

.message-card {
  background: rgba(245, 230, 211, 0.4);
  border: 1px solid #c33a2b;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 3px 0 #9b2a1a;
  transition: all 0.15s;
}

.message-card:hover {
  background: #fce4d6;
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.msg-avatar {
  border-radius: 50%;
  border: 2px solid #c33a2b;
  box-shadow: 0 2px 0 #9b2a1a;
}

.name {
  font-weight: 700;
  color: #5e2c1a;
  font-size: 16px;
}

.mood-badge {
  font-size: 22px;
  background: #fff5e0;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #c33a2b;
}

.message-text {
  font-size: 15px;
  color: #3a2214;
  padding: 8px 0;
  word-break: break-word;
  border-top: 1px dashed #c33a2b;
  border-bottom: 1px dashed #c33a2b;
  margin: 8px 0;
}

.time {
  font-size: 13px;
  color: #7a3a28;
  text-align: right;
  font-style: italic;
}

.empty-tip {
  text-align: center;
  color: #7a3a28;
  padding: 50px 20px;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.pagination-container {
  margin-top: 24px;
  display: flex;
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

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }
  .mobile-rank-list {
    display: block;
  }
  .kamihome-checkin-page {
    padding: 16px;
  }
  .container {
    flex-direction: column;
    gap: 24px;
  }
  .rank-section, .messages-section {
    padding: 18px 14px;
  }
  .section-title {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .kamihome-checkin-page {
    padding: 12px;
  }
  .rank-section, .messages-section {
    padding: 14px 10px;
  }
  .rank-card-header {
    gap: 8px;
  }
  .rank-number {
    font-size: 16px;
    min-width: 38px;
  }
  .rank-days {
    font-size: 12px;
    padding: 4px 10px;
  }
}
</style>