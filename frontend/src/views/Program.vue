<template>
  <div class="kamihome-program-page">
    <!-- 神社风格导航栏 -->
    <header class="shrine-nav">
      <div class="nav-content">
        <button class="nav-back kamihome-btn small" @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <h1 class="nav-title">
          <span class="title-icon">🦊</span> 结缘之间 <span class="title-icon">⛩️</span>
        </h1>
        <div style="width: 36px"></div>
      </div>
    </header>

    <div class="content">
      <!-- 奉纳 BV 卡片 -->
      <div class="submit-card kamihome-card">
        <div class="card-header">
          <h2><span class="header-icon">🎴</span> 奉纳 BV <span class="header-icon">🎴</span></h2>
        </div>
        <div class="submit-section">
          <el-input
            v-model="submitBv"
            placeholder="输入 BV 号，例如 BV1xx"
            clearable
            @keyup.enter="submitBvForAudit"
            class="bv-input"
          />
          <el-button
            type="danger"
            @click="submitBvForAudit"
            :loading="submitting"
            class="kamihome-btn"
          >
            奉纳
          </el-button>
        </div>
      </div>

      <!-- 缘结列表卡片 -->
      <div class="video-display-card kamihome-card">
        <div class="card-header">
          <h2><span class="header-icon">🌸</span> 缘结列表 <span class="header-icon">🌸</span></h2>
          <div class="sort-controls">
            <el-radio-group v-model="sortType" size="small" @change="handleSort" class="theme-radio-group">
              <el-radio-button label="time">按时间</el-radio-button>
              <el-radio-button label="name">按名字</el-radio-button>
              <el-radio-button label="play">按播放量</el-radio-button>
            </el-radio-group>
            <el-button 
              size="small" 
              @click="toggleSortOrder"
              class="kamihome-btn small sort-order-btn"
            >
              <el-icon><component :is="sortOrder === 'desc' ? 'ArrowDown' : 'ArrowUp'" /></el-icon>
              <span>{{ sortOrder === 'desc' ? '降序' : '升序' }}</span>
            </el-button>
          </div>
        </div>

        <div class="card-body">
          <div v-if="videosLoading" class="loading-state">
            <div class="loading-fox">
              <span class="fox-tail"></span>
              <span class="fox-tail"></span>
              <span class="fox-tail"></span>
            </div>
            <p>缘结加载中...</p>
          </div>
          <div v-else-if="sortedVideos.length === 0" class="empty-state">
            <el-empty description="暂无奉纳之物" :image-size="80" />
          </div>
          <div v-else class="video-grid">
            <div
              v-for="video in sortedVideos"
              :key="video.bvid"
              class="video-item"
            >
              <div class="video-cover-wrapper" @click="openDeployDialog(video)">
                <img 
                  :src="getProxiedImage(video.pic)" 
                  class="video-cover" 
                  @error="handleImageError"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                />
                <div class="video-overlay">
                  <span class="play-count">▶ {{ formatNumber(video.play) }}</span>
                </div>
                <div class="deploy-hint">结缘投放</div>
              </div>
              <div class="video-info">
                <div class="video-title" :title="video.title">{{ video.title }}</div>
                <div class="video-uploader" v-if="video.user_name">
                  <span class="uploader-label">奉纳者：</span>
                  <span class="uploader-name">{{ video.user_name }}</span>
                </div>
                <div class="video-time-row">⏳ {{ formatTime(video.created_at) }}</div>
                <div class="video-meta-row">
                  <span class="video-bv">{{ video.bvid }}</span>
                  <el-button 
                    v-if="isAdmin"
                    type="danger" 
                    circle 
                    size="small" 
                    class="delete-btn-inline kamihome-btn small danger"
                    @click.stop="confirmDeleteVideo(video)"
                    title="删除缘结"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除"
      width="400px"
      custom-class="kamihome-dialog"
    >
      <p>确定要删除缘结 <strong>{{ videoToDelete?.title }}</strong> 吗？</p>
      <p class="text-muted">BV号: {{ videoToDelete?.bvid }}</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false" class="kamihome-btn">取消</el-button>
        <el-button type="danger" @click="confirmDelete" :loading="deleting" class="kamihome-btn danger">
          确认删除
        </el-button>
      </template>
    </el-dialog>

    <!-- 投放选择对话框 -->
    <el-dialog
      v-model="deployDialogVisible"
      title="选择结缘之间"
      width="560px"
      custom-class="kamihome-dialog"
    >
      <div class="deploy-dialog-content">
        <div class="selected-video-info">
          <img :src="getProxiedImage(videoToDeploy?.pic)" class="deploy-video-cover" referrerpolicy="no-referrer" />
          <div class="deploy-video-title">{{ videoToDeploy?.title }}</div>
          <div class="deploy-video-uploader" v-if="videoToDeploy?.user_name">
            <span class="uploader-label">奉纳者：</span>
            <span class="uploader-name">{{ videoToDeploy.user_name }}</span>
          </div>
        </div>
        <div class="hall-buttons">
          <div 
            v-for="n in 4" 
            :key="n"
            class="hall-btn kamihome-btn"
            @click="handleHallClick(n, videoToDeploy)"
          >
            <span class="hall-label">{{ getShortHallName(n) }}</span>
            <span v-if="isHallOccupied(n) && !isCurrentUserOccupying(n)" class="occupant-mini">
              <img :src="hallOccupants[n-1]?.avatar ? hallOccupants[n-1].avatar.replace(/^http:\/\//, 'https://') : ''" class="occupant-mini-avatar" />
            </span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="deployDialogVisible = false" class="kamihome-btn">取消</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="occupyTipVisible" width="360px" custom-class="kamihome-dialog" :show-close="false">
      <div class="occupy-tip-content">
        <img :src="occupyTipData.avatar ? occupyTipData.avatar.replace(/^http:\/\//, 'https://') : ''" class="tip-avatar" />
        <p><strong>{{ occupyTipData.name }}</strong> 正在{{ occupyTipData.hallName }}结缘</p>
        <p class="tip-sub">该放映厅已被占用，请稍后再试哦～</p>
      </div>
      <template #footer><button class="kamihome-btn" @click="occupyTipVisible = false">知道啦</button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowDown, ArrowUp, Delete } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const token = localStorage.getItem('oi_token')

const isAdmin = computed(() => {
  const perm = userStore.user?.permission
  return perm === 0 || perm === 1 || perm === 2
})

// ---------- 奉纳 BV ----------
const submitBv = ref('')
const submitting = ref(false)

const submitBvForAudit = async () => {
  const bv = submitBv.value.trim()
  if (!bv) return ElMessage.warning('请输入 BV 号')
  if (!/^BV[a-zA-Z0-9]{10}$/.test(bv)) return ElMessage.warning('BV 号格式不正确')
  submitting.value = true
  try {
    const res = await axios.post('/api/bilibili/video/submit', { bv }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.data.code === 200) {
      ElMessage.success(res.data.message || '奉纳成功')
      submitBv.value = ''
      await fetchVideos()
    } else {
      ElMessage.error(res.data.message || '奉纳失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '奉纳失败')
  } finally {
    submitting.value = false
  }
}

// ---------- 缘结列表 ----------
const videos = ref([])
const videosLoading = ref(false)
const sortType = ref('time')
const sortOrder = ref('desc')

const currentUser = computed(() => {
  const u = userStore.user
  if (!u) return { id: 0, name: '游客' }
  const userId = u.id ?? u.user_id ?? u.userId ?? u._id ?? 0
  return { id: Number(userId), name: u.name || '游客' }
})

const getProxiedImage = (url) => {
  if (!url) return ''
  if (url.startsWith('data:') || url.includes('wsrv.nl')) return url
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=320&h=180&fit=cover&output=webp`
}

const getHallName = (hall) => {
  const names = ['狐火 · 缘结', '白蛇 · 祈愿', '鸦天狗 · 守護', '鬼灯 · 導き']
  return names[hall - 1] || `${hall} 号厅`
}

const getShortHallName = (hall) => {
  const names = ['缘结', '祈愿', '守護', '導き']
  return names[hall - 1] || `${hall} 号厅`
}

const hallOccupants = ref([null, null, null, null])
let sseConnections = []

const subscribeToAllHalls = () => {
  sseConnections.forEach(conn => conn && conn.close())
  sseConnections = []
  
  const fetchOccupants = async () => {
    try {
      const res = await axios.get('/api/cinema/occupants')
      if (res.data && res.data.success && res.data.data) {
        hallOccupants.value = res.data.data
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
          hallOccupants.value[data.hall - 1] = data.occupant
        }
      } catch (e) {}
    }
    sseConnection.onerror = () => {
      setTimeout(() => subscribeToHall(hallId), 3000)
    }
    sseConnections[hallId - 1] = sseConnection
  }
  
  subscribeToAllHalls._timer = occupantsTimer
}

const subscribeToHall = (hallId) => {
  if (sseConnections[hallId - 1]) sseConnections[hallId - 1].close()
  sseConnections[hallId - 1] = new EventSource(`/api/cinema/occupants-stream/${hallId}`)
  sseConnections[hallId - 1].onmessage = event => {
    try {
      const data = JSON.parse(event.data)
      if (data.hall >= 1 && data.hall <= 4) {
        hallOccupants.value[data.hall - 1] = data.occupant
      }
    } catch (e) {}
  }
  sseConnections[hallId - 1].onerror = () => {
    setTimeout(() => subscribeToHall(hallId), 3000)
  }
}

const isHallOccupied = (hall) => {
  return !!hallOccupants.value[hall - 1]
}

const isCurrentUserOccupying = (hall) => {
  const occupant = hallOccupants.value[hall - 1]
  if (!occupant) return false
  return Number(occupant.id) === Number(currentUser.value.id)
}

const isHallBusy = (hall) => {
  const occupant = hallOccupants.value[hall - 1]
  if (!occupant) return false
  const bvs = JSON.parse(localStorage.getItem('cinemaBvs') || '["","","",""]')
  return occupant.bv === bvs[hall - 1]
}

const getHallButtonClass = (hall) => {
  if (isHallBusy(hall)) return 'hall-busy'
  if (isHallOccupied(hall)) return 'hall-idle'
  return 'hall-idle'
}

const getHallButtonType = (hall) => {
  if (!videoToDeploy.value) return 'default'
  if (isHallBusy(hall) && !isCurrentUserOccupying(hall)) return 'danger'
  return isVideoInHall(hall, videoToDeploy.value.bvid) ? 'success' : 'default'
}

const fetchVideoDetail = async (bv) => {
  try {
    const res = await axios.get(`/api/bilibili/video/detail/${bv}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    })
    if (res.data.code === 200 && res.data.data) {
      const data = res.data.data
      return {
        title: data.title,
        pic: data.pic,
        bvid: data.bvid,
        play: data.play || 0,
        user_name: data.owner?.name || ''
      }
    }
  } catch (error) {
    console.error(`获取视频详情失败 (${bv}):`, error.message)
  }
  return null
}

const fetchVideos = async () => {
  videosLoading.value = true
  try {
    const res = await axios.get('/api/bilibili/video/audited-bvs', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.data.code === 200) {
      const auditedList = res.data.data || []
      const videosWithDetails = []
      
      for (const item of auditedList) {
        const bv = item.bv
        const detail = await fetchVideoDetail(bv)
        if (detail) {
          videosWithDetails.push({
            ...detail,
            id: item.id,
            note: item.note || '',
            created_at: item.created_at,
            user_name: item.user_name || ''
          })
        }
      }
      
      videos.value = videosWithDetails
    }
  } catch (err) {
    console.error('获取缘结列表失败', err)
    ElMessage.error('获取缘结列表失败')
  } finally {
    videosLoading.value = false
  }
}

const sortedVideos = computed(() => {
  const list = [...videos.value]
  const order = sortOrder.value === 'asc' ? 1 : -1
  
  switch (sortType.value) {
    case 'time':
      list.sort((a, b) => order * ((a.created_at || 0) - (b.created_at || 0)))
      break
    case 'name':
      list.sort((a, b) => order * (a.title || '').localeCompare(b.title || '', 'zh-CN'))
      break
    case 'play':
      list.sort((a, b) => order * ((a.play || 0) - (b.play || 0)))
      break
  }
  
  return list
})

const handleSort = () => {}
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

// ---------- 菜单操作 ----------
const deleteDialogVisible = ref(false)
const videoToDelete = ref(null)
const deleting = ref(false)
const deployDialogVisible = ref(false)
const videoToDeploy = ref(null)
const occupyTipVisible = ref(false)
const occupyTipData = ref({ name: '', avatar: '', hallName: '' })

const openDeployDialog = (video) => {
  videoToDeploy.value = video
  deployDialogVisible.value = true
}

const isVideoInHall = (hall, bvid) => {
  if (!bvid) return false
  const savedBvs = localStorage.getItem('cinemaBvs')
  if (!savedBvs) return false
  try {
    const bvs = JSON.parse(savedBvs)
    return bvs[hall - 1] === bvid
  } catch (e) {
    return false
  }
}

const confirmDeleteVideo = (video) => {
  videoToDelete.value = video
  deleteDialogVisible.value = true
}

const deployToHall = async (hall, video) => {
  if (!video) return
  
  const bv = video.bvid || video.bv
  const cover = video.pic || video.cover || ''
  const title = video.title || ''
  
  const savedBvs = JSON.parse(localStorage.getItem('cinemaBvs') || '["","","",""]')
  const savedCovers = JSON.parse(localStorage.getItem('cinemaCovers') || '["","","",""]')
  const savedTitles = JSON.parse(localStorage.getItem('cinemaTitles') || '["","","",""]')
  
  if (hallOccupants.value[hall - 1] && !isCurrentUserOccupying(hall)) {
    occupyTipData.value = { name: hallOccupants.value[hall - 1].name, avatar: hallOccupants.value[hall - 1].avatar || '', hallName: getHallName(hall) }
    occupyTipVisible.value = true
    return
  }
  
  const existingHall = savedBvs.findIndex((item, index) => item === bv && index !== hall - 1)
  if (existingHall !== -1) {
    savedBvs[existingHall] = ''
    savedCovers[existingHall] = ''
    savedTitles[existingHall] = ''
  }
  
  savedBvs[hall - 1] = bv
  savedCovers[hall - 1] = cover
  savedTitles[hall - 1] = title
  
  localStorage.setItem('cinemaBvs', JSON.stringify(savedBvs))
  localStorage.setItem('cinemaCovers', JSON.stringify(savedCovers))
  localStorage.setItem('cinemaTitles', JSON.stringify(savedTitles))
  
  try {
    const res = await axios.post('/api/cinema/hall', { hall, bv, cover, title })
    if (!res.data || !res.data.success) {
      ElMessage.warning(res.data?.message || '该放映厅有人正在观看，请稍后再试')
      return
    }
  } catch (e) {
    if (e.response?.data?.message) {
      ElMessage.warning(e.response.data.message)
    } else {
      console.error('同步后端失败:', e)
    }
    return
  }
  
  if (existingHall !== -1) {
    ElMessage.info(`该缘结从 ${getHallName(existingHall + 1)} 移动到 ${getHallName(hall)}`)
  } else {
    ElMessage.success(`已将 "${title}" 结缘至 ${getHallName(hall)}`)
  }
  
  deployDialogVisible.value = false
  router.push('/')
}

const handleHallClick = (hall, video) => {
  if (!video) return
  const savedBvs = JSON.parse(localStorage.getItem('cinemaBvs') || '["","","",""]')
  const occupant = hallOccupants.value[hall - 1]
  
  if (occupant && !isCurrentUserOccupying(hall)) {
    occupyTipData.value = { name: occupant.name, avatar: occupant.avatar || '', hallName: getHallName(hall) }
    occupyTipVisible.value = true
    return
  }
  
  deployToHall(hall, video)
}

const confirmDelete = async () => {
  if (!videoToDelete.value) return
  deleting.value = true
  try {
    const bv = videoToDelete.value.bvid
    
    const res = await axios.delete(`/api/bilibili/video/audited-bvs/${videoToDelete.value.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.data.code === 200) {
      const savedBvs = localStorage.getItem('cinemaBvs')
      if (savedBvs) {
        try {
          const bvs = JSON.parse(savedBvs)
          if (Array.isArray(bvs) && bvs.length === 4) {
            const hallIndex = bvs.findIndex(item => item === bv)
            if (hallIndex !== -1) {
              bvs[hallIndex] = ''
              localStorage.setItem('cinemaBvs', JSON.stringify(bvs))
              
              const savedCovers = localStorage.getItem('cinemaCovers')
              if (savedCovers) {
                try {
                  const covers = JSON.parse(savedCovers)
                  if (Array.isArray(covers) && covers.length === 4) {
                    covers[hallIndex] = ''
                    localStorage.setItem('cinemaCovers', JSON.stringify(covers))
                  }
                } catch (e) {}
              }
              
              const savedTitles = localStorage.getItem('cinemaTitles')
              if (savedTitles) {
                try {
                  const titles = JSON.parse(savedTitles)
                  if (Array.isArray(titles) && titles.length === 4) {
                    titles[hallIndex] = ''
                    localStorage.setItem('cinemaTitles', JSON.stringify(titles))
                  }
                } catch (e) {}
              }
              
              await axios.delete(`/api/cinema/hall/${hallIndex + 1}`)
              
              ElMessage.success(`删除成功，该缘结已从${getHallName(hallIndex + 1)}移除`)
            } else {
              ElMessage.success('删除成功')
            }
          } else {
            ElMessage.success('删除成功')
          }
        } catch (e) {
          ElMessage.success('删除成功')
        }
      } else {
        ElMessage.success('删除成功')
      }
      deleteDialogVisible.value = false
      await fetchVideos()
    } else {
      ElMessage.error(res.data.message || '删除失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || '删除失败')
  } finally {
    deleting.value = false
    videoToDelete.value = null
  }
}

// ---------- 工具函数 ----------
const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatTime = (ts) => {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

const handleImageError = (e) => {
  e.target.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'320\' height=\'180\' viewBox=\'0 0 320 180\'%3E%3Crect width=\'320\' height=\'180\' fill=\'%23f5e6d3\'/%3E%3Ctext x=\'160\' y=\'95\' font-size=\'14\' text-anchor=\'middle\' fill=\'%23c33a2b\'%3E🦊 无封面%3C/text%3E%3C/svg%3E'
}

onMounted(() => {
  window.scrollTo(0, 0)
  fetchVideos()
  subscribeToAllHalls()
})

onUnmounted(() => {
  sseConnections.forEach(conn => conn && conn.close())
  if (subscribeToAllHalls._timer) clearInterval(subscribeToAllHalls._timer)
})
</script>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-program-page {
  min-height: 100vh;
  background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
}

.shrine-nav {
  position: sticky;
  top: 0;
  background: rgba(245, 230, 211, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 3px solid #c33a2b;
  box-shadow: 0 4px 0 #9b2a1a, 0 4px 10px rgba(160, 60, 40, 0.1);
  padding: 12px 16px;
  z-index: 10;
}

.nav-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
}

.nav-back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: #5e2c1a;
  text-shadow: 2px 2px 0 #f0d8c0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.title-icon {
  font-size: 24px;
}

.content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 16px;
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
  padding: 20px;
  margin-bottom: 24px;
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
  justify-content: center;
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

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 3px dashed #c33a2b;
  flex-wrap: wrap;
  gap: 10px;
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #5e2c1a;
  text-shadow: 2px 2px 0 #f0d8c0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 24px;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-radio-group :deep(.el-radio-button__inner) {
  background: #f5e6d3 !important;
  border: 1.5px solid #c33a2b !important;
  color: #5e2c1a !important;
  font-weight: 600;
  box-shadow: 0 2px 0 #9b2a1a;
  transition: all 0.1s;
  padding: 5px 12px;
}

.theme-radio-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: #c33a2b !important;
  color: #fff5e0 !important;
  box-shadow: 0 2px 0 #7a1e10;
  border-color: #a03020 !important;
}

.sort-order-btn {
  padding: 4px 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 70px;
}

.sort-order-btn .el-icon {
  margin-right: 0;
  font-size: 14px;
}

.submit-section {
  display: flex;
  gap: 12px;
}

.submit-section .el-input {
  flex: 1;
}

.bv-input :deep(.el-input__wrapper) {
  background: #fef7f0;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  box-shadow: 0 2px 0 #9b2a1a;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  padding-bottom: 8px;
}

.video-item {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(245, 230, 211, 0.6);
  border: 1.5px solid #c33a2b;
  box-shadow: 0 3px 0 #9b2a1a;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}

.video-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 0 #9b2a1a;
  background: #fce4d6;
}

@media (max-width: 1200px) {
  .video-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
}

@media (max-width: 768px) {
  .video-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .video-item {
    border-radius: 10px;
  }
  
  .video-title {
    font-size: 12px;
    min-height: 30px;
  }
  
  .video-info {
    padding: 8px;
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .video-grid {
    gap: 8px;
  }
  
  .video-item {
    border-radius: 8px;
  }
  
  .video-title {
    font-size: 11px;
    -webkit-line-clamp: 2;
    min-height: 28px;
  }
}

.video-cover-wrapper {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
}

.video-cover {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  display: block;
  background-color: #f5e6d3;
}

.video-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 8px;
  font-size: 12px;
  color: #fff5e0;
  background: linear-gradient(transparent, rgba(90, 40, 20, 0.8));
}

.play-count {
  background: #c33a2b;
  padding: 2px 10px;
  border-radius: 20px;
  font-weight: 600;
  border: 1px solid #fff5e0;
}

.deploy-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #c33a2b;
  color: #fff5e0;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid #fff5e0;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  box-shadow: 0 3px 0 #9b2a1a;
}

.video-cover-wrapper:hover .deploy-hint {
  opacity: 1;
}

.delete-btn-inline {
  margin-left: auto;
  width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
  font-size: 12px !important;
}

.video-info {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.video-title {
  font-size: 13px;
  font-weight: 700;
  color: #5e2c1a;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
  min-height: 34px;
}

.video-uploader {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(200, 60, 40, 0.15);
  padding: 4px 10px;
  border-radius: 16px;
  width: fit-content;
  border: 1px solid rgba(200, 60, 40, 0.3);
  margin: 2px 0;
}

.uploader-label {
  font-weight: 700;
  color: #a03820;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}

.uploader-name {
  font-weight: 600;
  color: #3a2214;
  letter-spacing: 0.3px;
}

.video-time-row {
  font-size: 11px;
  color: #7a3a28;
}

.video-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.video-bv {
  font-family: monospace;
  background: rgba(200, 60, 40, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
  color: #a03820;
  font-size: 10px;
  border: 1px solid #c33a2b;
}

.video-note {
  font-size: 10px;
  color: #c33a2b;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-style: italic;
}

.deploy-video-uploader {
  font-size: 13px;
  margin-top: 6px;
  padding: 4px 12px;
  background: rgba(200, 60, 40, 0.1);
  border-radius: 20px;
  display: inline-block;
}

.deploy-video-uploader .uploader-label {
  font-weight: 700;
  color: #a03820;
}

.deploy-video-uploader .uploader-name {
  font-weight: 600;
  color: #3a2214;
}

.loading-state {
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

.empty-state {
  padding: 50px;
  text-align: center;
}

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

.text-muted {
  color: #7a3a28;
  font-size: 13px;
}

.deploy-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.selected-video-info {
  text-align: center;
  width: 100%;
}

.deploy-video-cover {
  width: 100%;
  max-width: 280px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #c33a2b;
  margin-bottom: 10px;
}

.deploy-video-title {
  font-size: 14px;
  font-weight: 600;
  color: #5e2c1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.hall-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
}

.hall-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  box-sizing: border-box;
  white-space: nowrap;
  transition: all 0.3s;
  cursor: pointer;
  text-align: center;
  flex: 1;
}

.hall-label {
  display: inline-block;
  white-space: nowrap;
  text-align: center;
}

.occupant-mini {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
}

.occupant-mini-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1.5px solid #c33a2b;
  object-fit: cover;
}

.occupy-tip-content {
  text-align: center;
}

.occupy-tip-content .tip-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #c33a2b;
  margin-bottom: 16px;
  object-fit: cover;
}

.occupy-tip-content .tip-sub {
  color: #7a5a48;
}

@media (max-width: 768px) {
  .hall-buttons {
    grid-template-columns: 1fr;
  }
  
  .deploy-video-cover {
    max-width: 100%;
  }
}
</style>