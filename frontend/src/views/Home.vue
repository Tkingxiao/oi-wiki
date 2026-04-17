<template>
  <div class="kamihome">
    <div class="body">
      <!-- 主播信息卡片 -->
      <div class="anchor-card kamihome-card">
        <div class="avatar-section">
          <!-- 头像 + 悬浮气泡资料卡 -->
          <el-popover
            placement="auto"
            :width="isMobile ? '90vw' : 400"
            trigger="click"
            popper-class="kamihome-popover"
            transition="el-zoom-in-top"
            :show-arrow="false"
            :teleported="true"
            :hide-after="0"
          >
            <template #reference>
              <div class="avatar kamihome-avatar">
                <img v-if="defaultAvatar" :src="defaultAvatar" alt="主播头像" />
                <div v-else class="avatar-loading"></div>
                <span class="avatar-fox">🦊</span>
              </div>
            </template>
            <!-- 御守样式资料卡 -->
            <div class="popover-bubble">
              <div class="bubble-header">
                <img :src="defaultAvatar" alt="主播头像" class="bubble-avatar" />
                <div class="bubble-name-badge">
                  <span class="bubble-name">{{ anchorInfo.name }}</span>
                  <span class="bubble-gender">{{ anchorInfo.gender }}</span>
                </div>
              </div>
              <div class="bubble-details">
                <div class="detail-row">
                  <span class="detail-icon">⛩️</span>
                  <span class="detail-label">神职</span>
                  <span class="detail-value">{{ anchorInfo.hobby }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-icon">🆔</span>
                  <span class="detail-label">神使编号</span>
                  <span class="detail-value">{{ anchorInfo.uid }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-icon">📏</span>
                  <span class="detail-label">身高</span>
                  <span class="detail-value">{{ anchorInfo.height }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-icon">⚖️</span>
                  <span class="detail-label">体重</span>
                  <span class="detail-value">{{ anchorInfo.weight }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-icon">🌸</span>
                  <span class="detail-label">灵力</span>
                  <span class="detail-value">{{ anchorInfo.iq }}</span>
                </div>
              </div>
              <div class="bubble-footer">
                <span class="footer-tag">🦊 神様、お願い！ 🦊</span>
              </div>
            </div>
          </el-popover>
          <div class="anchor-text">
            <h2 class="anchor-name kamihome-title">{{ anchorName }}</h2>
            <p class="anchor-id">社务所 · {{ roomInfo.short_id || roomInfo.room_id || '---' }}</p>
          </div>
        </div>
        <button class="kamihome-btn" @click="goTo('https://space.bilibili.com/3546585537448033', false)">
          进入神社 <span class="btn-effect">⛩️</span>
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container kamihome-card">
        <div class="loading-fox">
          <span class="fox-tail"></span>
          <span class="fox-tail"></span>
          <span class="fox-tail"></span>
        </div>
        <p>神灵凭依中<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container kamihome-card">
        <h3>😿 结缘失败 😿</h3>
        <p>{{ error }}</p>
        <button @click="fetchRoomInfo" class="kamihome-btn">重新祈愿</button>
      </div>

      <!-- 数据卡片网格 -->
      <div v-else class="stats-grid">
        <!-- 参拜人数 -->
        <div class="stat-card kamihome-card">
          <div class="card-header">
            <span class="card-icon">🙏</span>
            <h3>参拜人数</h3>
          </div>
          <div class="card-body">
            <div class="stat-number-wrapper">
              <el-statistic :value="roomInfo.attention">
                <template #title>
                  <span class="stat-title">{{ roomInfo.attention >= 10000 ? '目标是万社来朝！' : '今日参拜者' }}</span>
                </template>
                <template #suffix>
                  <span class="stat-suffix">/{{ roomInfo.attention >= 10000 ? '200,000' : '10,000' }}</span>
                </template>
              </el-statistic>
            </div>
            <div class="stat-tip">
              <template v-if="roomInfo.attention >= 100000">
                恭喜万人参拜达成！距十万还差 {{ formatNumber(200000 - roomInfo.attention) }} 人
              </template>
              <template v-else>
                距万人参拜还差 {{ formatNumber(10000 - roomInfo.attention) }} 人
              </template>
            </div>
            <transition :name="attentionChange.type === 'increase' ? 'float-up' : 'float-down'">
              <div v-if="attentionChange.show" class="float-tag" :class="attentionChange.type">
                {{ attentionChange.type === 'increase' ? '🦊' : '🌸' }}{{ attentionChange.value }}
              </div>
            </transition>
          </div>
          <div class="deco-fox"></div>
          <div class="stat-decoration"></div>
        </div>

        <!-- 神使数量 -->
        <div class="stat-card kamihome-card">
          <div class="card-header">
            <span class="card-icon">🦊</span>
            <h3>神使数量</h3>
          </div>
          <div class="card-body">
            <div class="stat-number-wrapper">
              <el-statistic :value="captain">
                <template #title><span class="stat-title">今日新缔结的神使</span></template>
                <template #suffix><span class="stat-suffix">位神使</span></template>
              </el-statistic>
            </div>
            <div class="stat-tip">距离百位神使还差 {{ formatNumber(100 - captain) }} 位</div>
            <transition :name="captainChange.type === 'increase' ? 'float-up' : 'float-down'">
              <div v-if="captainChange.show" class="float-tag" :class="captainChange.type">
                {{ captainChange.type === 'increase' ? '🦊' : '🌸' }}{{ captainChange.value }}
              </div>
            </transition>
          </div>
          <div class="deco-fox"></div>
          <div class="stat-decoration"></div>
        </div>

        <!-- 神力修行 -->
        <div class="stat-card kamihome-card">
          <div class="card-header">
            <span class="card-icon">⏳</span>
            <h3>神力修行</h3>
            <button class="detail-link" @click="showLiveDetailDialog = true">查看修行录</button>
          </div>
          <div class="card-body">
            <div class="stat-number-wrapper">
              <el-statistic :value="liveHours">
                <template #title><span class="stat-title">本月修行时长</span></template>
                <template #suffix><span class="stat-suffix">/90h</span></template>
              </el-statistic>
            </div>
            <div class="stat-tip" :class="getRemainClass()">
              <template v-if="90 - liveHours > 0 && calculateRemainingEffectiveDays() > 0">
                还差 {{ formatHoursToHM(90 - liveHours) }}，{{ calculateRemainingEffectiveDays() }}天有效修行
              </template>
              <template v-else-if="90 - liveHours <= 0 && calculateRemainingEffectiveDays() > 0">
                时长达标！还差{{ calculateRemainingEffectiveDays() }}天有效修行
              </template>
              <template v-else-if="90 - liveHours > 0 && calculateRemainingEffectiveDays() <= 0">
                还差{{ formatHoursToHM(90 - liveHours) }}，有效天数达标！
              </template>
              <template v-else>
                全部达标！🎉 神灵圆满！
              </template>
            </div>
          </div>
          <div class="deco-fox"></div>
          <div class="stat-decoration"></div>
        </div>

        <!-- 神社状态 -->
        <div class="stat-card kamihome-card status-card">
          <div class="card-header">
            <span class="card-icon">🎐</span>
            <h3>神社状态</h3>
          </div>
          <div class="card-body status-body">
            <div class="cover-wrapper">
              <img :src="roomInfo.user_cover" alt="直播封面" class="cover-img" />
            </div>
            <div class="status-info">
              <div class="status-badge" :class="getStatusClass()" @click="goTo('https://live.bilibili.com/1809236885', false)">
                {{ getStatusText(roomInfo.live_status) }}
                <span class="badge-torii">⛩️</span>
              </div>
              <p v-if="roomInfo.live_status === 1" class="online-count">
                当前参拜者 <strong>{{ formatNumber(roomInfo.online) }}</strong> 人
              </p>
              <p v-else class="offline-tip">神社暂时关闭</p>
            </div>
          </div>
          <div class="deco-fox"></div>
          <div class="stat-decoration"></div>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="kamihome-divider">
        <span class="divider-text">⛩️ 神様はじめました ⛩️</span>
      </div>

      <!-- 结缘之间区域 -->
      <div class="cinema-section">
        <h2 class="section-title">
          <span class="title-deco">🦊</span> 结缘之间 · 神使的房间 <span class="title-deco">🦊</span>
        </h2>
        <div class="cinema-grid">
          <div v-for="hall in 4" :key="hall" class="cinema-card kamihome-card" @click="handleCinemaClick($event, hall)">
            <div class="cinema-header">
              <span class="hall-icon">{{ getShinshiIcon(hall) }}</span>
              <span class="hall-name">{{ getShinshiName(hall) }}</span>
              <span v-if="hallOccupants[hall-1] && hallOccupants[hall-1].avatar" class="occupant-avatar-header">
                <img :src="hallOccupants[hall-1].avatar" referrerpolicy="no-referrer" />
              </span>
            </div>
            <div class="cinema-body">
              <div class="cinema-placeholder" :class="{ 'has-video': cinemaCovers[hall-1] }">
                <img v-if="cinemaCovers[hall-1]" :src="cinemaCovers[hall-1]" alt="视频封面" class="cinema-cover" referrerpolicy="no-referrer" />
                <div v-else class="video-placeholder">
                  <i class="fas fa-torii-gate"></i>
                  <span>进入房间</span>
                </div>
              </div>
              <div v-if="cinemaTitles[hall-1]" class="cinema-title">{{ cinemaTitles[hall-1] }}</div>
              <div class="fox-mark">🦊</div>
            </div>
          </div>

          <div class="cinema-card program-card kamihome-card" @click="goToProgram">
            <div class="cinema-header">
              <span class="hall-icon">🦊</span>
              <span class="hall-name">绘马挂所</span>
            </div>
            <div class="cinema-body program-body">
              <div class="program-placeholder">
                <i class="fas fa-scroll"></i>
                <p>查看神使的绘马</p>
                <p class="sub-text">🦊 願い事、叶いますように 🦊</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 修行时长弹窗 -->
    <el-dialog
      v-model="showLiveDetailDialog"
      title="📜 修行绘马"
      width="650px"
      :close-on-click-modal="false"
      custom-class="kamihome-dialog"
      align-center
    >
      <!-- ... 弹窗内容不变 ... -->
      <div class="calendar-container">
        <div class="month-control">
          <button class="kamihome-btn small" @click="changeMonth(-1)">◀ 上月</button>
          <span class="current-month">{{ currentYear }}年{{ currentMonth }}月</span>
          <button class="kamihome-btn small" @click="changeMonth(1)">下月 ▶</button>
        </div>
        <div class="month-summary">
          <div>总修行时长：<strong>{{ formatLiveTime(calculateMonthTotal()) }}</strong></div>
          <div>有效修行日：<strong>{{ calculateEffectiveDays() }}/{{ requiredEffectiveDays }}</strong></div>
          <div>还差：<strong>{{ calculateRemainingEffectiveDays() }}</strong> 天</div>
        </div>
        <div class="calendar-grid">
          <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="day-cell"
            :class="{
              'other-month': day.isOtherMonth,
              'today': day.isCurrentDay,
              'has-live': day.liveHours > 0,
              'effective': day.liveHours > 0 && day.isEffective,
              'ineffective': day.liveHours > 0 && !day.isEffective
            }"
            @click="selectDate(day)"
          >
            <span class="day-num">{{ day.day }}</span>
            <span v-if="day.liveHours > 0" class="live-time">{{ formatLiveTime(day.liveHours) }}</span>
          </div>
        </div>
        <div v-if="selectedDate" class="selected-day-detail">
          <h4>{{ selectedDate.year }}年{{ selectedDate.month }}月{{ selectedDate.day }}日 修行详情</h4>
          <div v-if="selectedDate.liveSessions.length > 0" class="sessions-list">
            <div v-for="(s, i) in selectedDate.liveSessions" :key="i" class="session-item">
              <p><span>开始</span> {{ s.startTime }}</p>
              <p><span>结束</span> {{ s.endTime }}</p>
              <p><span>时长</span> {{ formatSessionDuration(s.startTime, s.endTime) }}</p>
              <p><span>修行内容</span> {{ s.title }}</p>
            </div>
          </div>
          <div v-else class="no-session">当日无修行记录</div>
        </div>
      </div>
    </el-dialog>

    <!-- 全屏播放器 -->
    <el-dialog
      v-model="fullscreenPlayerVisible"
      :title="`${currentHallName} · 结缘中`"
      width="45%"
      :fullscreen="isMobile"
      custom-class="fullscreen-dialog"
      @close="handleFullscreenClose"
    >
      <div class="video-wrapper">
        <iframe
          v-if="fullscreenBv"
          :src="getHighQualityIframeSrc(fullscreenBv)"
          allowfullscreen
          class="fullscreen-video"
        ></iframe>
        <div v-else class="empty-video">请先选择结缘之物</div>
      </div>
      <template #footer>
        <button class="kamihome-btn" @click="fullscreenPlayerVisible = false">关闭</button>
      </template>
    </el-dialog>

    <!-- 占用提示彩蛋 -->
    <el-dialog v-model="occupyTipVisible" width="360px" custom-class="occupy-dialog" :show-close="false">
      <div class="occupy-content">
        <img :src="occupyTipData.avatar ? occupyTipData.avatar.replace(/^http:\/\//, 'https://') : ''" class="tip-avatar" />
        <p><strong>{{ occupyTipData.name }}</strong> 正在{{ occupyTipData.hallName }}结缘</p>
        <p class="tip-sub">请稍后再试哦～</p>
      </div>
      <template #footer><button class="kamihome-btn" @click="occupyTipVisible = false">知道啦</button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getRoomInfo, getMasterInfo, getTopListNew, getLiveDuration } from '@/api/bilibiliApis.js'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// ---------- 基础数据 ----------
const loading = ref(true)
const error = ref(null)
const anchorName = ref('黛棠OI')
const defaultAvatar = ref('')
const roomInfo = ref({})
const captain = ref(0)
const requiredEffectiveDays = 22
const isMobile = ref(window.innerWidth <= 768)

const anchorInfo = ref({
  name: '黛棠OI',
  gender: '女',
  hobby: '火鸡面见习生',
  uid: '3546585537448033',
  height: '125cm',
  weight: '48kg',
  iq: '518451'
})

// 放映厅相关
const cinemaBvs = ref(['', '', '', ''])
const cinemaCovers = ref(['', '', '', ''])
const cinemaTitles = ref(['', '', '', ''])
const fullscreenPlayerVisible = ref(false)
const fullscreenBv = ref('')

// 获取视频封面和标题
const fetchVideoInfo = async (bv) => {
  if (!bv) return { cover: '', title: '' }
  try {
    const response = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bv}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
      },
      timeout: 10000
    })
    if (response.data.code === 0) {
      return {
        cover: response.data.data.pic || '',
        title: response.data.data.title || ''
      }
    }
  } catch (error) {
    console.error('获取视频信息失败:', error)
  }
  return { cover: '', title: '' }
}

// 加载所有放映厅的封面和标题（从后端API获取，优先使用B站API补充）
const loadCinemaCovers = async () => {
  // 从后端获取已保存的封面/标题
  try {
    const res = await axios.get(`${API_BASE}/halls`)
    if (res.data && res.data.success && res.data.data) {
      const halls = res.data.data
      for (let i = 0; i < 4; i++) {
        const hall = halls[i]
        if (hall && hall.bv) {
          // 确保BV与cinema_halls一致
          if (cinemaBvs.value[i] !== hall.bv) {
            cinemaBvs.value[i] = hall.bv
          }
          // 使用后端保存的封面/标题（如果有）
          if (hall.cover && (!cinemaCovers.value[i] || cinemaCovers.value[i] !== hall.cover)) {
            cinemaCovers.value[i] = hall.cover
          }
          if (hall.title && (!cinemaTitles.value[i] || cinemaTitles.value[i] !== hall.title)) {
            cinemaTitles.value[i] = hall.title
          }
          // 如果后端没有封面，尝试从B站获取
          if (!cinemaCovers.value[i]) {
            const info = await fetchVideoInfo(hall.bv)
            if (info.cover) {
              cinemaCovers.value[i] = info.cover
            }
            if (info.title && !cinemaTitles.value[i]) {
              cinemaTitles.value[i] = info.title
            }
          }
        } else if (!cinemaBvs.value[i]) {
          // 槽位为空
          cinemaCovers.value[i] = ''
          cinemaTitles.value[i] = ''
        }
      }
    }
  } catch (e) {
    console.error('获取放映厅封面失败:', e)
  }
  localStorage.setItem('cinemaBvs', JSON.stringify(cinemaBvs.value))
  localStorage.setItem('cinemaCovers', JSON.stringify(cinemaCovers.value))
  localStorage.setItem('cinemaTitles', JSON.stringify(cinemaTitles.value))
}

// 从后端获取放映厅视频数据
const fetchCinemaHalls = async () => {
  try {
    const res = await axios.get(`${API_BASE}/halls`)
    if (res.data && res.data.success && res.data.data) {
      const halls = res.data.data
      
      // 从后端按位置提取数据
      const backendBvs = halls.map(h => h?.bv || '')
      
      // 仅同步BV（按位置对应），封面由 loadCinemaCovers 负责加载
      for (let i = 0; i < 4; i++) {
        if (backendBvs[i] && backendBvs[i] !== cinemaBvs.value[i]) {
          cinemaBvs.value[i] = backendBvs[i]
        }
      }
    }
  } catch (e) {
    console.error('获取放映厅列表失败:', e)
  }
}

// 从后端同步审核通过的视频列表（清理已删除的视频）
const syncAuditedVideos = async () => {
  try {
    const token = userStore.token || localStorage.getItem('token')
    const res = await axios.get('/api/bilibili/video/audited-bvs', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.data && res.data.data && Array.isArray(res.data.data)) {
      const videos = res.data.data
      const validBvs = new Set(videos.map(v => v.bv).filter(Boolean))
      
      let changed = false
      const mergedBvs = [...cinemaBvs.value]
      
      // 清除不在audited_bv表中的无效视频
      for (let i = 0; i < 4; i++) {
        if (mergedBvs[i] && !validBvs.has(mergedBvs[i])) {
          mergedBvs[i] = ''
          cinemaCovers.value[i] = ''
          cinemaTitles.value[i] = ''
          changed = true
          // 同时清除后端的cinema_halls数据
          try {
            await axios.delete(`${API_BASE}/hall/${i + 1}`)
          } catch (e) {}
        }
      }
      
      // 填充空槽位
      for (let i = 0; i < 4; i++) {
        if (!mergedBvs[i] && videos[i] && videos[i].bv) {
          mergedBvs[i] = videos[i].bv
          changed = true
        }
      }
      
      if (changed) {
        cinemaBvs.value = mergedBvs
        localStorage.setItem('cinemaBvs', JSON.stringify(mergedBvs))
        localStorage.setItem('cinemaCovers', JSON.stringify(cinemaCovers.value))
        localStorage.setItem('cinemaTitles', JSON.stringify(cinemaTitles.value))
        await loadCinemaCovers()
      }
    }
  } catch (e) {
    console.error('同步审核视频列表失败:', e)
  }
}

// 定时器轮询检查 BV 变化
let syncTimer = null
let syncAuditedTimer = null
const startCinemaSync = () => {
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    const saved = localStorage.getItem('cinemaBvs')
    if (saved) {
      try {
        const arr = JSON.parse(saved)
        if (Array.isArray(arr) && arr.length === 4) {
          // 检查是否有变化
          let changed = false
          for (let i = 0; i < 4; i++) {
            if (cinemaBvs.value[i] !== arr[i]) {
              changed = true
              break
            }
          }
          if (changed) {
            cinemaBvs.value = arr
            // 重新加载封面
            loadCinemaCovers()
          }
        }
      } catch (e) {}
    }
  }, 2000)
}

const currentHall = ref(1)
const currentHallName = computed(() => `${getShinshiName(currentHall.value)}`)

const hallOccupants = ref([null, null, null, null])
const occupyTipVisible = ref(false)
const occupyTipData = ref({ name: '', avatar: '', hallName: '' })

const currentUser = computed(() => {
  const u = userStore.user
  if (!u) return { id: 0, name: '游客', avatar: '' }
  const userId = u.id ?? u.user_id ?? u.userId ?? u._id ?? 0
  return { id: Number(userId), name: u.name || '游客', avatar: u.avatar || '' }
})

// 直播时长弹窗相关
const showLiveDetailDialog = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const selectedDate = ref(null)
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const calendarDays = ref([])
const liveRecords = ref([])

const prevAttention = ref(null)
const prevCaptain = ref(null)
const attentionChange = ref({ show: false, value: 0, type: '' })
const captainChange = ref({ show: false, value: 0, type: '' })

// ---------- 辅助函数 ----------
const formatNumber = num => {
  if (!num && num !== 0) return '---'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const getStatusText = status => {
  const map = { 0: '社务暂停', 1: '开社中', 2: '神乐舞中' }
  return map[status] || '未知'
}

const getStatusClass = () => {
  if (roomInfo.value?.live_status === 1) return 'live'
  if (roomInfo.value?.live_status === 2) return 'replay'
  return 'offline'
}

const getRemainClass = () => {
  const remainHours = 90 - liveHours.value
  const remainDays = calculateRemainingEffectiveDays()
  if (remainHours <= 0 && remainDays <= 0) return 'all-done'
  if (remainHours <= 0) return 'hours-done'
  if (remainDays <= 0) return 'days-done'
  return 'both-need'
}

const goTo = (url, isRoute) => {
  if (isRoute) router.push(url)
  else window.open(url, '_blank')
}

const formatHoursToHM = hours => {
  const m = Math.round(hours * 60)
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h && min) return `${h}小时${min}分钟`
  else if (h) return `${h}小时`
  else return `${min}分钟`
}

const calculateSessionDuration = (start, end) => {
  if (typeof start === 'number' && typeof end === 'number') return Math.floor((end - start) / 60000)
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let d = (eh - sh) * 60 + (em - sm)
  if (d < 0) d += 1440
  return d
}

const timestampToDate = ts => new Date(ts)
const timestampToTimeString = ts => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const fetchLiveRecords = async month => {
  try {
    const res = await getLiveDuration(month)
    if (res.code === 200) liveRecords.value = res.data || []
    else liveRecords.value = []
  } catch (e) {
    liveRecords.value = []
  }
}

const generateFakeLiveData = (year, month, day) => {
  const sessions = liveRecords.value.filter(s => {
    const end = s.endTime || Date.now()
    const startDay = new Date(year, month - 1, day, 0, 0, 0).getTime()
    const endDay = new Date(year, month - 1, day, 23, 59, 59).getTime()
    return s.startTime <= endDay && end >= startDay
  })

  let totalHours = 0
  sessions.forEach(s => {
    const end = s.endTime || Date.now()
    const sd = timestampToDate(s.startTime)
    const ed = timestampToDate(end)
    const cur = new Date(year, month - 1, day)
    const isStart = sd.getFullYear() === cur.getFullYear() && sd.getMonth() === cur.getMonth() && sd.getDate() === cur.getDate()
    const isEnd = ed.getFullYear() === cur.getFullYear() && ed.getMonth() === cur.getMonth() && ed.getDate() === cur.getDate()

    if (isStart && isEnd) totalHours += calculateSessionDuration(s.startTime, end) / 60
    else if (isStart) {
      const startSeconds = sd.getHours() * 3600 + sd.getMinutes() * 60 + sd.getSeconds()
      const remainSeconds = 86400 - startSeconds
      totalHours += remainSeconds / 3600
    } else if (isEnd) {
      const endSeconds = ed.getHours() * 3600 + ed.getMinutes() * 60 + ed.getSeconds()
      totalHours += endSeconds / 3600
    } else totalHours += 24
  })

  let effective = false
  for (const s of sessions) {
    const end = s.endTime || Date.now()
    const sd = timestampToDate(s.startTime)
    const ed = timestampToDate(end)
    const cur = new Date(year, month - 1, day)
    const isStart = sd.getFullYear() === cur.getFullYear() && sd.getMonth() === cur.getMonth() && sd.getDate() === cur.getDate()
    const isEnd = ed.getFullYear() === cur.getFullYear() && ed.getMonth() === cur.getMonth() && ed.getDate() === cur.getDate()
    let dayMin = 0
    if (isStart && isEnd) dayMin = calculateSessionDuration(s.startTime, end)
    else if (isStart) {
      const startSeconds = sd.getHours() * 3600 + sd.getMinutes() * 60 + sd.getSeconds()
      const remainSeconds = 86400 - startSeconds
      dayMin = Math.floor(remainSeconds / 60)
    }
    else if (isEnd) {
      const endSeconds = ed.getHours() * 3600 + ed.getMinutes() * 60 + ed.getSeconds()
      dayMin = Math.floor(endSeconds / 60)
    }
    else dayMin = 1440
    if (dayMin >= 120) {
      effective = true
      break
    }
  }

  const formatted = sessions.map(s => {
    const end = s.endTime || Date.now()
    const sd = timestampToDate(s.startTime)
    const ed = timestampToDate(end)
    const cur = new Date(year, month - 1, day)
    const isStart = sd.getFullYear() === cur.getFullYear() && sd.getMonth() === cur.getMonth() && sd.getDate() === cur.getDate()
    const isEnd = ed.getFullYear() === cur.getFullYear() && ed.getMonth() === cur.getMonth() && ed.getDate() === cur.getDate()
    let st = timestampToTimeString(s.startTime)
    let et = s.endTime ? timestampToTimeString(s.endTime) : '修行中'
    if (isStart && !isEnd) et = '24:00（跨日）'
    else if (!isStart && isEnd) st = '00:00（接前日）'
    else if (!isStart && !isEnd) {
      st = '00:00（接前日）'
      et = '24:00（跨日）'
    }
    return { startTime: st, endTime: et, title: s.title }
  })

  return { hours: totalHours, isEffective: effective, sessions: formatted }
}

const generateCalendar = () => {
  const days = []
  const first = new Date(currentYear.value, currentMonth.value - 1, 1)
  const start = new Date(first)
  start.setDate(start.getDate() - first.getDay())
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    const data = generateFakeLiveData(y, m, day)
    days.push({
      day,
      month: m,
      year: y,
      isOtherMonth: m !== currentMonth.value,
      isCurrentDay: day === new Date().getDate() && d.getMonth() === new Date().getMonth() && y === new Date().getFullYear(),
      liveHours: data.hours,
      isEffective: data.isEffective,
      liveSessions: data.sessions
    })
  }
  calendarDays.value = days
}

const calculateMonthTotal = () => {
  let t = 0
  calendarDays.value.forEach(d => {
    if (d.month === currentMonth.value) t += d.liveHours
  })
  return t
}

const calculateEffectiveDays = () => {
  let e = 0
  calendarDays.value.forEach(d => {
    if (d.month === currentMonth.value && d.isEffective) e++
  })
  return e
}

const calculateRemainingEffectiveDays = () => Math.max(0, requiredEffectiveDays - calculateEffectiveDays())

const formatLiveTime = h => {
  const m = Math.round(h * 60)
  return `${Math.floor(m / 60)}h${m % 60}m`
}

const formatSessionDuration = (start, end) => {
  const extract = s => (s.includes('（') ? s.split('（')[0] : s)
  const s = extract(start)
  const e = extract(end)
  if (end === '修行中') {
    const [sh, sm] = s.split(':').map(Number)
    const n = new Date()
    let min = (n.getHours() - sh) * 60 + (n.getMinutes() - sm)
    if (min < 0) min += 1440
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h && m) return `${h}小时${m}分钟（进行中）`
    else if (h) return `${h}小时（进行中）`
    else return `${m}分钟（进行中）`
  }
  let min
  if (e === '24:00') {
    const [sh, sm] = s.split(':').map(Number)
    min = (24 - sh) * 60 - sm
  } else {
    min = calculateSessionDuration(s, e)
  }
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}小时${m}分钟`
  else if (h) return `${h}小时`
  else return `${m}分钟`
}

const changeMonth = async delta => {
  currentMonth.value += delta
  if (currentMonth.value > 12) {
    currentMonth.value = 1
    currentYear.value++
  } else if (currentMonth.value < 1) {
    currentMonth.value = 12
    currentYear.value--
  }
  await fetchLiveRecords(`${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`)
  generateCalendar()
  selectedDate.value = null
}

const selectDate = d => { selectedDate.value = d }

const liveHours = computed(() => {
  const n = new Date()
  const y = n.getFullYear()
  const m = n.getMonth()
  const start = new Date(y, m, 1, 0, 0, 0).getTime()
  const end = new Date(y, m + 1, 0, 23, 59, 59).getTime()
  let min = 0
  liveRecords.value.forEach(s => {
    const se = s.endTime || Date.now()
    const es = Math.max(s.startTime, start)
    const ee = Math.min(se, end)
    if (es < ee) min += Math.floor((ee - es) / 60000)
  })
  return Math.round((min / 60) * 10) / 10
})

// 获取神使房间名称（美化版）
const getShinshiName = (hallNum) => {
  const names = ['狐火 · 缘结', '白蛇 · 祈愿', '鸦天狗 · 守護', '鬼灯 · 導き']
  return names[hallNum - 1] || '未知'
}

const getShinshiIcon = (hallNum) => {
  const icons = ['🦊', '🐍', '🐦‍', '🏮']
  return icons[hallNum - 1] || '🦊'
}

const isHallBusy = (hall) => {
  const occupant = hallOccupants.value[hall - 1]
  if (!occupant) return false
  const bvs = JSON.parse(localStorage.getItem('cinemaBvs') || '["","","",""]')
  return occupant.bv === bvs[hall - 1]
}

// ---------- SSE 连接 ----------
let sseConnections = []

const subscribeToAllHalls = () => {
  sseConnections.forEach(conn => conn && conn.close())
  sseConnections = []
  
  const fetchOccupants = async () => {
    try {
      const res = await axios.get('/api/cinema/occupants')
      if (res.data && res.data.success && res.data.data) {
        const occ = res.data.data
        occ.forEach(o => {
          if (o && o.avatar) {
            o.avatar = o.avatar.replace('http://', 'https://')
          }
        })
        hallOccupants.value = occ
      } else {
        hallOccupants.value = [null, null, null, null]
      }
    } catch (e) {
      hallOccupants.value = [null, null, null, null]
    }
  }
  
  fetchOccupants()
  const occupantsTimer = setInterval(fetchOccupants, 2000)
  
  for (let hallId = 1; hallId <= 4; hallId++) {
    const sseConnection = new EventSource(`/api/cinema/occupants-stream/${hallId}`)
    sseConnection.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        if (data.hall >= 1 && data.hall <= 4) {
          const o = data.occupant
          if (o && o.avatar) {
            o.avatar = o.avatar.replace('http://', 'https://')
          }
          hallOccupants.value[data.hall - 1] = o
        }
      } catch (e) {}
    }
    sseConnection.onerror = err => {
      setTimeout(() => subscribeToHall(hallId), 3000)
    }
    sseConnections[hallId - 1] = sseConnection
  }
  
  subscribeToAllHalls._timer = occupantsTimer
}

const subscribeToHall = hallId => {
  if (sseConnections[hallId - 1]) sseConnections[hallId - 1].close()
  sseConnections[hallId - 1] = new EventSource(`/api/cinema/occupants-stream/${hallId}`)
  sseConnections[hallId - 1].onmessage = event => {
    try {
      const data = JSON.parse(event.data)
      if (data.hall >= 1 && data.hall <= 4) {
        hallOccupants.value[data.hall - 1] = data.occupant
      }
    } catch (e) {
      console.error('[SSE] 解析消息失败:', e)
    }
  }
  sseConnections[hallId - 1].onerror = err => {
    console.error('[SSE] 连接错误，3秒后重连:', err)
    setTimeout(() => subscribeToHall(hallId), 3000)
  }
}

// ---------- 后端 API ----------
const API_BASE = '/api/cinema'
const occupyHallAPI = async (hallIdx, bv) => {
  try {
    const res = await axios.post(`${API_BASE}/occupy`, {
      hall: hallIdx + 1,
      bv,
      userId: currentUser.value.id,
      userName: currentUser.value.name,
      userAvatar: currentUser.value.avatar
    })
    return res.data
  } catch (e) {
    return { success: false, message: '请求失败' }
  }
}

const releaseHallAPI = async hallIdx => {
  try { await axios.post(`${API_BASE}/release`, { hall: hallIdx + 1, userId: currentUser.value.id }) } catch (e) {}
}

const canOccupyHall = idx => {
  const occupant = hallOccupants.value[idx]
  if (!occupant) return true
  return Number(occupant.id) === Number(currentUser.value.id)
}

const getHighQualityIframeSrc = bv => {
  if (!bv) return ''
  return `https://player.bilibili.com/player.html?bvid=${bv}&page=1&high_quality=1&qn=80&danmaku=0&autoplay=1`
}

const handleCinemaClick = async (event, hall) => {
  event.stopPropagation()
  const bv = cinemaBvs.value[hall - 1]
  if (!bv) return ElMessage.warning('该房间暂无结缘之物')

  if (!canOccupyHall(hall - 1)) {
    const o = hallOccupants.value[hall - 1]
    occupyTipData.value = { name: o.name, avatar: o.avatar, hallName: `${getShinshiName(hall)}` }
    occupyTipVisible.value = true
    return
  }

  const res = await occupyHallAPI(hall - 1, bv)
  if (res.success) {
    currentHall.value = hall
    fullscreenBv.value = bv
    fullscreenPlayerVisible.value = true
    startOccupancyRefresh()
  } else {
    if (res.occupant) {
      occupyTipData.value = { name: res.occupant.name, avatar: res.occupant.avatar, hallName: `${getShinshiName(hall)}` }
      occupyTipVisible.value = true
    } else {
      ElMessage.error(res.message || '占用失败')
    }
  }
}

const handleFullscreenClose = async () => {
  await releaseHallAPI(currentHall.value - 1)
  fullscreenBv.value = ''
  fullscreenPlayerVisible.value = false
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
}

let refreshTimer = null

const startOccupancyRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(async () => {
    try {
      await axios.post('/api/cinema/occupy/refresh', {
        hall: currentHall.value,
        userId: currentUser.value.id
      })
    } catch (e) {}
  }, 10000)
}

const goToProgram = () => router.push('/program')
const handleResize = () => { isMobile.value = window.innerWidth <= 768 }

// ---------- 数据获取 ----------
const fetchRoomInfo = async (first = false) => {
  const [room, captainInfo] = await Promise.all([getRoomInfo(), getTopListNew()])
  if (room.code === 200) {
    const na = room.data.attention
    const nc = captainInfo.data.info.num
    if (!first) {
      if (prevAttention.value !== null && na !== prevAttention.value) {
        attentionChange.value = {
          show: true,
          value: Math.abs(na - prevAttention.value),
          type: na > prevAttention.value ? 'increase' : 'decrease'
        }
        setTimeout(() => (attentionChange.value.show = false), 1000)
      }
      if (prevCaptain.value !== null && nc !== prevCaptain.value) {
        captainChange.value = {
          show: true,
          value: Math.abs(nc - prevCaptain.value),
          type: nc > prevCaptain.value ? 'increase' : 'decrease'
        }
        setTimeout(() => (captainChange.value.show = false), 1000)
      }
    }
    roomInfo.value = room.data
    captain.value = nc
    prevAttention.value = na
    prevCaptain.value = nc
  } else {
    error.value = room.message || '获取失败'
  }
}

const getUserInfo = async (first = false) => {
  loading.value = true
  try {
    const u = await getMasterInfo()
    defaultAvatar.value = u.data.info.face
    await fetchRoomInfo(first)
  } catch (e) {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  await getUserInfo(true)

  const now = new Date()
  await fetchLiveRecords(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  generateCalendar()

  const saved = localStorage.getItem('cinemaBvs')
  if (saved) {
    try {
      const arr = JSON.parse(saved)
      if (Array.isArray(arr) && arr.length === 4) cinemaBvs.value = arr
    } catch (e) {}
  }

  const savedCovers = localStorage.getItem('cinemaCovers')
  if (savedCovers) {
    try {
      const arr = JSON.parse(savedCovers)
      if (Array.isArray(arr) && arr.length === 4) cinemaCovers.value = arr
    } catch (e) {}
  }

  const savedTitles = localStorage.getItem('cinemaTitles')
  if (savedTitles) {
    try {
      const arr = JSON.parse(savedTitles)
      if (Array.isArray(arr) && arr.length === 4) cinemaTitles.value = arr
    } catch (e) {}
  }

  await fetchCinemaHalls()
  await loadCinemaCovers()
  await syncAuditedVideos()
  startCinemaSync()
  syncAuditedTimer = setInterval(syncAuditedVideos, 30000)

  subscribeToAllHalls()
  setInterval(fetchRoomInfo, 60000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  sseConnections.forEach(conn => conn && conn.close())
  if (syncTimer) clearInterval(syncTimer)
  if (syncAuditedTimer) clearInterval(syncAuditedTimer)
  if (subscribeToAllHalls._timer) clearInterval(subscribeToAllHalls._timer)
})
</script>

<style scoped>
/* ==================== 元气少女缘结神主题全局 ==================== */
.kamihome {
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

.body {
  max-width: 1400px;
  margin: 0 auto;
}

/* ==================== 和风卡片基础样式 ==================== */
.kamihome-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(5px);
  border: 1.5px solid #c33a2b;
  border-radius: 12px 12px 12px 4px;
  box-shadow: 0 4px 0 #9b2a1a, 0 6px 12px rgba(160, 60, 40, 0.1);
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.kamihome-card::after {
  content: '🦊';
  position: absolute;
  bottom: 6px;
  right: 12px;
  font-size: 14px;
  color: #c33a2b;
  opacity: 0.25;
}

.kamihome-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 #9b2a1a, 0 10px 16px rgba(160, 60, 40, 0.15);
}

/* ==================== 主播卡片 ==================== */
.anchor-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 30px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.kamihome-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #c33a2b;
  box-shadow: 0 3px 0 #9b2a1a, 0 0 0 3px #fce4d6;
  cursor: pointer;
  transition: transform 0.2s;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.kamihome-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-fox {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 22px;
  color: #c33a2b;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));
  opacity: 0.9;
}

.kamihome-avatar:hover {
  transform: scale(1.02);
}

.avatar-loading {
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(45deg, #f0d8c0, #f0d8c0 10px, #fce4d6 10px, #fce4d6 20px);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  from { background-position: 0 0; }
  to { background-position: 40px 0; }
}

.anchor-name {
  font-size: 34px;
  font-weight: 600;
  color: #5e2c1a;
  margin: 0 0 5px;
  text-shadow: 2px 2px 0 #f0d8c0;
  letter-spacing: 1px;
}

.anchor-id {
  font-size: 16px;
  color: #7a3a28;
  margin: 0;
  font-weight: 500;
}

/* ==================== 和风按钮 ==================== */
.kamihome-btn {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 10px 24px;
  font-size: 16px;
  font-weight: bold;
  color: #5e2c1a;
  box-shadow: 0 3px 0 #9b2a1a, 0 4px 8px rgba(160, 60, 40, 0.15);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.kamihome-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a, 0 6px 12px rgba(160, 60, 40, 0.2);
  background: #fce4d6;
}

.kamihome-btn:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 #9b2a1a, 0 4px 8px rgba(160, 60, 40, 0.15);
}

.kamihome-btn.small {
  padding: 6px 16px;
  font-size: 14px;
}

.btn-effect {
  font-size: 18px;
}

/* ==================== 加载/错误状态 ==================== */
.loading-container,
.error-container {
  padding: 60px 20px;
  text-align: center;
  color: #5e2c1a;
}

.loading-fox {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  margin: 0 auto 20px;
}

.fox-tail {
  width: 10px;
  height: 30px;
  background: #c33a2b;
  border-radius: 10px 10px 2px 2px;
  animation: foxSway 1.2s infinite ease-in-out;
  transform-origin: bottom center;
}

.fox-tail:nth-child(1) { animation-delay: 0s; }
.fox-tail:nth-child(2) { animation-delay: 0.15s; }
.fox-tail:nth-child(3) { animation-delay: 0.3s; }

@keyframes foxSway {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}

.dot {
  animation: blink 1.4s infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 20% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 1; }
}

/* ==================== 数据卡片网格 ==================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-bottom: 40px;
}

.stat-card {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  position: relative;
}

.stat-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: repeating-linear-gradient(90deg, #c33a2b, #c33a2b 6px, transparent 6px, transparent 12px);
  opacity: 0.3;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px dashed #c33a2b;
  padding-bottom: 10px;
  flex-wrap: wrap;
}

.card-icon {
  font-size: 28px;
}

.card-header h3 {
  font-size: 22px;
  font-weight: 600;
  color: #5e2c1a;
  margin: 0;
  text-shadow: 1px 1px 0 #f0d8c0;
}

.detail-link {
  margin-left: auto;
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: bold;
  color: #5e2c1a;
  cursor: pointer;
  box-shadow: 0 2px 0 #9b2a1a;
  font-family: inherit;
  transition: all 0.1s;
  white-space: nowrap;
}

.detail-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 0 #9b2a1a;
}

.card-body {
  position: relative;
  flex: 1;
  padding-bottom: 8px;
}

.stat-number-wrapper :deep(.el-statistic__number) {
  font-size: 52px !important;
  font-weight: 600 !important;
  color: #a03820 !important;
  text-shadow: 2px 2px 0 #f0d8c0;
  -webkit-text-stroke: 0.5px #c33a2b;
}

.stat-title {
  font-size: 16px;
  color: #5e2c1a;
  font-weight: bold;
}

.stat-suffix {
  font-size: 18px;
  color: #a03820;
  margin-left: 6px;
}

.stat-tip {
  font-size: 14px;
  margin-top: 12px;
  padding: 6px 12px;
  background: #fce4d6;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  color: #5e2c1a;
  font-weight: bold;
}

.float-tag {
  position: absolute;
  right: 0;
  top: 10px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 40px;
  border: 1.5px solid #c33a2b;
  background: white;
  pointer-events: none;
  box-shadow: 0 2px 0 #9b2a1a;
}

.float-tag.increase {
  color: #c33a2b;
  border-color: #c33a2b;
}

.float-tag.decrease {
  color: #4a6a5a;
  border-color: #4a6a5a;
}

.deco-fox {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 10px;
  background: repeating-linear-gradient(90deg, #c33a2b, #c33a2b 6px, transparent 6px, transparent 12px);
  opacity: 0.15;
}

/* ==================== 神社状态卡片 ==================== */
.cover-wrapper {
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1.5px solid #c33a2b;
  overflow: hidden;
  box-shadow: 0 3px 0 #9b2a1a;
}

.cover-img {
  width: 100%;
  display: block;
}

.status-info {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 30px 30px 30px 6px;
  background: #c33a2b;
  border: 2px solid #a03020;
  color: #fff5e0;
  font-weight: 600;
  font-size: 20px;
  text-shadow: 1px 1px 0 #7a1e10;
  box-shadow: 0 3px 0 #7a1e10, 0 4px 8px rgba(160, 40, 20, 0.2);
  cursor: pointer;
  position: relative;
}

.status-badge.live {
  background: #d44c3a;
  box-shadow: 0 3px 0 #9b2a1a, 0 4px 8px rgba(200, 60, 40, 0.25);
}

.status-badge.replay {
  background: #8a6e5a;
  box-shadow: 0 3px 0 #6a4e3a;
}

.badge-torii {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 24px;
  height: 24px;
  font-size: 20px;
  line-height: 24px;
  text-align: center;
  background: inherit;
  border-right: 2px solid #a03020;
  border-bottom: 2px solid #a03020;
  border-radius: 0 0 10px 0;
  transform: rotate(45deg);
}

.online-count {
  margin-top: 16px;
  font-size: 16px;
  color: #5e2c1a;
  font-weight: 500;
}

.online-count strong {
  font-size: 24px;
  color: #c33a2b;
  text-shadow: 1px 1px 0 #f0d8c0;
}

.offline-tip {
  margin-top: 16px;
  color: #7a5a48;
}

/* ==================== 分割线 ==================== */
.kamihome-divider {
  margin: 48px 0 36px;
  text-align: center;
  position: relative;
}

.kamihome-divider::before,
.kamihome-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 25%;
  height: 4px;
  background: repeating-linear-gradient(90deg, #c33a2b, #c33a2b 8px, transparent 8px, transparent 16px);
}

.kamihome-divider::before {
  left: 0;
}

.kamihome-divider::after {
  right: 0;
}

.divider-text {
  font-size: 20px;
  font-weight: bold;
  color: #5e2c1a;
  background: #f9f3e7;
  padding: 0 20px;
  text-shadow: 1px 1px 0 #fff;
}

/* ==================== 结缘之间区域 ==================== */
.section-title {
  font-size: 32px;
  font-weight: 600;
  color: #5e2c1a;
  text-align: center;
  margin-bottom: 30px;
  text-shadow: 2px 2px 0 #f0d8c0;
}

.title-deco {
  font-size: 28px;
}

.cinema-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
}

.cinema-card {
  padding: 16px 12px;
  cursor: pointer;
}

.cinema-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 2px dashed #c33a2b;
  padding-bottom: 8px;
  position: relative;
}

.hall-icon {
  font-size: 28px;
}

.hall-name {
  font-size: 16px;
  font-weight: bold;
  color: #5e2c1a;
}

.occupant-avatar-header {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #f56c6c;
  box-shadow: 0 0 6px rgba(245, 108, 108, 0.4);
}

.occupant-avatar-header img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  aspect-ratio: 16 / 9;
  background: #f0d8c0;
  border-radius: 10px;
  border: 1.5px solid #c33a2b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #5e2c1a;
  font-weight: bold;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.03);
}

.video-placeholder i {
  font-size: 48px;
  margin-bottom: 8px;
  color: #a03820;
}

.cinema-placeholder {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 245, 247, 0.9);
  border: 2px dashed #c33a2b;
}

.cinema-placeholder.has-video {
  border-style: solid;
}

.cinema-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cinema-title {
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(255, 245, 247, 0.9);
  border-radius: 6px;
  font-size: 12px;
  color: #c33a2b;
  font-weight: 500;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.occupant-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  color: #5e2c1a;
  font-weight: bold;
}

.occupant-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #c33a2b;
}

.fox-mark {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 24px;
  font-weight: 700;
  color: rgba(200, 60, 40, 0.1);
}

.program-card .program-body {
  justify-content: center;
  align-items: center;
  text-align: center;
  min-height: 160px;
}

.program-placeholder i {
  font-size: 48px;
  color: #a03820;
  margin-bottom: 12px;
}

.program-placeholder p {
  margin: 4px 0;
  color: #5e2c1a;
  font-weight: bold;
}

/* ==================== 御守风格资料卡气泡 ==================== */
.kamihome-popover {
  background: rgba(255, 250, 240, 0.95) !important;
  backdrop-filter: blur(8px);
  border: 2px solid #c33a2b !important;
  border-radius: 20px 20px 20px 6px !important;
  box-shadow: 0 5px 0 #9b2a1a, 0 12px 20px rgba(160, 40, 20, 0.15) !important;
  padding: 0 !important;
  overflow: visible !important;
}

.kamihome-popover::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 40px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 12px 16px 12px 0;
  border-color: transparent #c33a2b transparent transparent;
}

.kamihome-popover::after {
  content: '';
  position: absolute;
  left: -11px;
  top: 42px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 13px 10px 0;
  border-color: transparent rgba(255, 250, 240, 0.95) transparent transparent;
}

.popover-bubble {
  padding: 24px 20px;
}

.bubble-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 2px dashed #c33a2b;
  margin-bottom: 4px;
}

.bubble-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid #c33a2b;
  box-shadow: 0 3px 0 #9b2a1a;
  object-fit: cover;
  flex-shrink: 0;
}

.bubble-name-badge {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.bubble-name {
  font-size: 24px;
  font-weight: 600;
  color: #5e2c1a;
  word-break: break-word;
}

.bubble-gender {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 14px;
  font-weight: bold;
  color: #5e2c1a;
  align-self: flex-start;
  box-shadow: 0 2px 0 #9b2a1a;
}

.bubble-details {
  padding: 12px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-row {
  display: grid;
  grid-template-columns: 28px 80px 1fr;
  align-items: center;
  gap: 8px;
}

.detail-icon {
  font-size: 20px;
  text-align: center;
}

.detail-label {
  font-weight: bold;
  color: #7a3a28;
  font-size: 15px;
}

.detail-value {
  font-weight: bold;
  color: #5e2c1a;
  font-size: 16px;
  white-space: nowrap;
  text-align: right;
  padding-right: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bubble-footer {
  text-align: center;
  padding-top: 16px;
  border-top: 2px dashed #c33a2b;
  margin-top: 8px;
}

.footer-tag {
  background: #fce4d6;
  border: 1.5px solid #c33a2b;
  border-radius: 40px;
  padding: 8px 24px;
  font-weight: bold;
  color: #5e2c1a;
  box-shadow: 0 2px 0 #9b2a1a;
  display: inline-block;
  font-size: 15px;
  white-space: nowrap;
}

/* ==================== 绘马弹窗 ==================== */
.kamihome-dialog {
  background: #fef7f0 !important;
  border: 3px solid #c33a2b !important;
  border-radius: 20px !important;
  box-shadow: 0 6px 0 #9b2a1a, 0 20px 30px rgba(160, 40, 20, 0.12) !important;
  max-width: 95vw;
}

.kamihome-dialog :deep(.el-dialog__header) {
  border-bottom: 2px dashed #c33a2b;
  padding: 20px 24px;
}

.kamihome-dialog :deep(.el-dialog__title) {
  font-size: 24px;
  font-weight: 600;
  color: #5e2c1a;
}

.calendar-container {
  padding: 8px 0;
  overflow-x: auto;
}

.month-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.current-month {
  font-size: 22px;
  font-weight: 600;
  color: #a03820;
}

.month-summary {
  display: flex;
  justify-content: space-around;
  background: #fce4d6;
  border: 1.5px solid #c33a2b;
  border-radius: 40px;
  padding: 12px;
  margin-bottom: 24px;
  box-shadow: 0 3px 0 #9b2a1a;
  font-weight: bold;
  color: #5e2c1a;
  flex-wrap: wrap;
  gap: 10px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  min-width: 300px;
}

.weekday {
  text-align: center;
  font-weight: 700;
  color: #a03820;
  padding: 8px;
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 12px;
  box-shadow: 0 2px 0 #9b2a1a;
}

.day-cell {
  aspect-ratio: 1;
  background: white;
  border: 1.5px solid #c33a2b;
  border-radius: 12px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 0 #9b2a1a;
  font-weight: bold;
  color: #5e2c1a;
}

.day-cell.other-month {
  opacity: 0.4;
}

.day-cell.today {
  background: #f5e6d3;
  border-color: #a03820;
}

.day-cell.has-live.effective {
  background: #d8e0d4;
  border-color: #4a6a5a;
}

.day-cell.has-live.ineffective {
  background: #f0d8d0;
  border-color: #a05040;
}

.day-num {
  font-size: 16px;
  font-weight: 700;
}

.live-time {
  font-size: 10px;
  margin-top: 2px;
}

.selected-day-detail {
  margin-top: 24px;
  background: white;
  border: 1.5px solid #c33a2b;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 3px 0 #9b2a1a;
}

.session-item p {
  margin: 6px 0;
  color: #5e2c1a;
}

.session-item span {
  font-weight: 700;
  margin-right: 8px;
  color: #a03820;
}

.no-session {
  color: #7a5a48;
}

/* ==================== 全屏播放器 ==================== */
.fullscreen-dialog :deep(.el-dialog__body) {
  padding: 0 !important;
  background: #000;
}

.video-wrapper {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
}

.fullscreen-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.empty-video {
  color: white;
  text-align: center;
  padding: 60px;
}

/* ==================== 占用提示弹窗 ==================== */
.occupy-dialog {
  background: #fef7f0 !important;
  border: 3px solid #c33a2b !important;
  border-radius: 20px !important;
  box-shadow: 0 5px 0 #9b2a1a, 0 15px 25px rgba(160, 40, 20, 0.12) !important;
  max-width: 90vw;
}

.occupy-content {
  text-align: center;
}

.tip-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #c33a2b;
  margin-bottom: 16px;
  object-fit: cover;
}

.tip-sub {
  color: #7a5a48;
}

/* ==================== 动画 ==================== */
.float-up-enter-active { animation: floatUp 1.5s ease-out forwards; }
.float-up-leave-active { animation: floatUp 1.5s ease-out reverse forwards; }
@keyframes floatUp {
  0% { opacity: 0; transform: translateY(15px); }
  20% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(-25px); }
  100% { opacity: 0; transform: translateY(-35px); }
}

.float-down-enter-active { animation: floatDown 1.5s ease-out forwards; }
.float-down-leave-active { animation: floatDown 1.5s ease-out reverse forwards; }
@keyframes floatDown {
  0% { opacity: 0; transform: translateY(-35px); }
  20% { opacity: 1; transform: translateY(-25px); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(15px); }
}

/* ==================== 响应式 ==================== */
@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .cinema-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .kamihome { padding: 16px; }
  .anchor-card { flex-direction: column; align-items: stretch; }
  .stats-grid { grid-template-columns: 1fr; }
  .cinema-grid { grid-template-columns: 1fr; }
  .anchor-name { font-size: 28px; }
  .section-title { font-size: 24px; }
  .title-deco { font-size: 22px; }
  .kamihome-divider::before,
  .kamihome-divider::after { width: 15%; }
  .divider-text { font-size: 16px; }
  .month-summary { flex-direction: column; align-items: flex-start; }
  .detail-row { grid-template-columns: 28px 70px 1fr; }
}

@media (max-width: 480px) {
  .kamihome { padding: 12px; }
  .anchor-card { padding: 16px; }
  .avatar-section { gap: 12px; }
  .kamihome-avatar { width: 60px; height: 60px; }
  .anchor-name { font-size: 24px; }
  .anchor-id { font-size: 14px; }
  .kamihome-btn { padding: 8px 16px; font-size: 14px; }
  .stat-number-wrapper :deep(.el-statistic__number) { font-size: 40px !important; }
  .card-header h3 { font-size: 18px; }
  .detail-link { font-size: 12px; padding: 2px 10px; }
  .bubble-name { font-size: 20px; }
  .detail-label { font-size: 14px; min-width: 60px; }
}
</style>