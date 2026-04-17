<template>
  <header class="kamihome-top-bar" @click="closeDropdown" role="banner" aria-label="页面页眉">
    <div class="container">
      <!-- 左侧品牌区域 -->
      <div class="brand">
        <el-avatar :size="28" :src="userAvatar" class="brand-avatar" @click="onBrandClick" />
        <router-link to="/" class="brand-link" @keydown="onBrandKeydown">
          <span class="brand-text">🦊 黛棠OI · 御守所</span>
        </router-link>
      </div>

      <!-- 桌面端导航栏 -->
      <el-menu :default-active="activeNavIndex" class="navigation-menu" mode="horizontal" :ellipsis="false"
        @select="handleMenuSelect">
        <template v-for="item in navItems" :key="item.path">
          <el-sub-menu v-if="item.isDropdown" :index="item.name" :show-timeout="100" :hide-timeout="100" popper-class="kamihome-submenu">
            <template #title>
              <span>{{ item.name }}</span>
            </template>
            <el-menu-item v-for="link in friendlyLinks" :key="link.url" :index="link.url" @click="openLink(link.url)">
              <span>{{ link.name }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <span>{{ item.name }}</span>
          </el-menu-item>
        </template>
      </el-menu>

      <!-- 右侧用户区域 -->
      <div class="user-area">
        <!-- 未登录状态 -->
        <el-button class="login kamihome-btn" type="primary" @click="handleLogin" plain v-if="!isAuthenticated">
          参拜登录
        </el-button>

        <!-- 已登录状态 -->
        <div v-else class="user-info" @click.stop="toggleDropdown">
          <span class="user-name">{{ username }}</span>

          <!-- 用户下拉菜单 -->
          <div v-if="showDropdown" class="user-dropdown" @click.stop>
            <div class="dropdown-header">
              <el-avatar :size="45" :src="userAvatar" />
              <div class="dropdown-info">
                <div class="dropdown-name">{{ username }}</div>
                <el-tag :type="getPermissionName().type" style="padding: 0;">
                  {{ getPermissionName().name }}
                </el-tag>
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <ul class="dropdown-menu">
              <li v-for="item in userMenuItems" :key="item.action" class="dropdown-item"
                @click="handleUserMenuClick(item.action)">
                <span>{{ item.name }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 移动端侧边栏菜单 -->
      <div v-show="showMobileMenu || isSidebarClosing" class="mobile-sidebar-overlay" @click="closeMobileMenu">
        <div class="mobile-sidebar" :class="{ 'sidebar-closing': isSidebarClosing }" @click.stop>
          <div class="mobile-sidebar-header">
            <h3>🦊 御守所</h3>
          </div>
          <el-menu :default-active="activeNavIndex" class="mobile-sidebar-menu" @select="handleMenuSelect">
            <template v-for="item in navItems" :key="item.path">
              <el-sub-menu v-if="item.isDropdown" :index="item.name" popper-class="kamihome-submenu">
                <template #title>
                  <span>{{ item.name }}</span>
                </template>
                <el-menu-item v-for="link in friendlyLinks" :key="link.url" :index="link.url"
                  @click="openLink(link.url)">
                  <span>{{ link.name }}</span>
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="item.path">
                <span>{{ item.name }}</span>
              </el-menu-item>
            </template>
          </el-menu>
        </div>
      </div>
    </div>
  </header>

  <!-- 打卡弹窗组件 -->
  <CheckinDialog ref="checkinDialogRef" />
</template>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'
import defaultAvatar from '@/assets/用户.jpg'
import CheckinDialog from '@/components/CheckinDialog.vue'

const showDropdown = ref(false)
const showMobileMenu = ref(false)
const isSidebarClosing = ref(false)
const sidebarTimer = ref(null)
const checkinDialogRef = ref(null)

const friendlyLinks = [
  { name: '梨按钮', url: 'https://www.shanerubian.online/' },
  { name: '虎按钮', url: 'https://zhaoshihu.shanerubian.online/' },
  { name: '羽毛球按钮', url: 'https://xinggongyun.shanerubian.online/' },
  { name: '虾按钮', url: 'https://xia.shanerubian.online/' },
  { name: '龟按钮', url: 'https://kami.shanerubian.online/' },
  { name: '浣熊按钮', url: 'https://huanxiong.shanerubian.online/' },
  { name: '埋按钮', url: 'https://maibutton.yangdujun.top/' },
  { name: '猫丸子按钮', url: 'https://maruko.xiaofei.icu/' },
  { name: '潇猪按钮', url: 'https://www.dv7.asia/' },
]

const router = useRouter()
const userStore = useUserStore()

const { token, user } = storeToRefs(userStore)

const isAuthenticated = computed(() => !!token.value && !!user.value)
const username = computed(() => user.value?.name || '')
const userAvatar = computed(() => {
  const url = user.value?.avatar || defaultAvatar
  return url.replace(/^http:\/\//, 'https://')
})

const permission = computed(() => {
  const p = user.value?.permission;
  return typeof p === 'number' ? p : parseInt(p) || 3;
})

// 监听用户权限变化，当被撤销管理员权限时强制刷新导航
const permissionKey = ref(0)
watch(() => user.value?.permission, () => {
  permissionKey.value++
})

const getPermissionName = () => {
  const permissionName = {
    0: { name: '大神主', type: 'danger' },
    1: { name: '神主', type: 'danger' },
    2: { name: '神官', type: 'warning' },
    3: { name: '黛言人', type: 'primary' },
  }
  return permissionName[permission.value] || permissionName[3]
}

const navItems = computed(() => {
  // 添加 permissionKey 作为依赖，确保权限变化时重新计算
  permissionKey.value
  
  const items = [
    { name: '本殿', path: '/' },
    { name: '绘马', path: '/photo-album' },
    { name: '祝词', path: '/audio' },
    { name: '参拜录', path: '/checkin-rank' },
    { name: '神乐', path: '/chatRoom' },
    { name: '祭礼表', path: '/plan-document' },
    { name: '神託', path: '/announcement' },
  ]

  const perm = permission.value;
  if (isAuthenticated.value && (perm === 0 || perm === 1 || perm === 2)) {
    items.push({ name: '神域', path: '/admin' })
  }

  items.push({ name: '缘结', path: '#', isDropdown: true })

  return items
})

const activeNavIndex = computed(() => {
  const currentPath = router.currentRoute.value.path
  const exactMatch = navItems.value.find(item => item.path === currentPath)
  if (exactMatch) return exactMatch.path
  
  const prefixMatch = navItems.value.find(item => {
    if (item.path === '#' || item.path === '/') return false
    return currentPath.startsWith(item.path) && 
           (currentPath.length === item.path.length || 
            currentPath[item.path.length] === '/')
  })
  
  return prefixMatch ? prefixMatch.path : '/'
})

const handleMenuSelect = (index) => {
  if (index.startsWith('http')) return
  navigateTo(index)
}

const navigateTo = (path) => {
  router.push(path)
  showDropdown.value = false
  showMobileMenu.value = false
}

const userMenuItems = [
  { name: '氏子帳', action: 'user-center' },
  { name: '参拜', action: 'checkin' },
  { name: '退社', action: 'logout' }
]

const handleLogin = () => {
  router.push('/login')
}

const handleLogout = () => {
  userStore.logout()
  // 清除所有本地存储的会话信息
  localStorage.removeItem('oi_token')
  sessionStorage.clear()
  // 跳转到主页并强制刷新
  window.location.href = '/'
}

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
  showDropdown.value = false
}

const toggleMobileMenu = () => {
  if (showMobileMenu.value && !isSidebarClosing.value) {
    closeMobileMenu()
  } else if (!showMobileMenu.value && !isSidebarClosing.value) {
    openMobileMenu()
  }
  showDropdown.value = false
}

const openMobileMenu = () => {
  if (sidebarTimer.value) {
    clearTimeout(sidebarTimer.value)
    sidebarTimer.value = null
  }
  showMobileMenu.value = true
  isSidebarClosing.value = false
}

const cleanupTimer = () => {
  if (sidebarTimer.value) {
    clearTimeout(sidebarTimer.value)
    sidebarTimer.value = null
  }
}

onUnmounted(() => {
  cleanupTimer()
})

const onBrandClick = (e) => {
  const isMobile = window.innerWidth <= 768
  if (isMobile) {
    e.preventDefault()
    toggleMobileMenu()
  }
}

const onBrandKeydown = (e) => {
  const isMobile = window.innerWidth <= 768
  if (!isMobile) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleMobileMenu()
  }
}

const closeMobileMenu = () => {
  if (isSidebarClosing.value) return
  if (sidebarTimer.value) {
    clearTimeout(sidebarTimer.value)
  }
  isSidebarClosing.value = true
  sidebarTimer.value = setTimeout(() => {
    showMobileMenu.value = false
    isSidebarClosing.value = false
    sidebarTimer.value = null
  }, 250)
}

const handleUserMenuClick = async (action) => {
  switch (action) {
    case 'user-center':
      router.push('/user-center')
      break
    case 'checkin':
      checkinDialogRef.value?.open()
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退社吗？', '退社确认', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger',
          customClass: 'kamihome-message-box'  // 主题化弹框
        })
        handleLogout()
      } catch { }
      break
  }
  showDropdown.value = false
  showMobileMenu.value = false
}

const openLink = (url) => {
  window.open(url, '_blank')
}
</script>

<style scoped>
.kamihome-top-bar {
  width: 100%;
  height: 60px;
  background: #f5e6d3;
  border-bottom: 3px solid #c33a2b;
  box-shadow: 0 4px 0 #9b2a1a, 0 4px 10px rgba(160, 60, 40, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(6px);
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
}

.container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  max-width: 1400px;
  margin: 0 auto;
}

/* 品牌区域 */
.brand {
  display: flex;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #5e2c1a;
  font-weight: 700;
  font-size: 20px;
  transition: opacity 0.3s ease;
  text-shadow: 1px 1px 0 #f0d8c0;
}

.brand-link:hover {
  opacity: 0.7;
}

.brand-avatar {
  margin-right: 8px;
  border-radius: 8px;
  border: 2px solid #c33a2b;
  box-shadow: 0 2px 0 #9b2a1a;
}

@media (min-width: 769px) {
  .brand-avatar {
    display: none;
  }
}

/* 导航栏菜单 */
.navigation-menu {
  flex: 1;
  display: flex;
  justify-content: center;
  position: absolute;
  left: 50vw;
  transform: translateX(-50%);
  border-bottom: none;
  height: 70%;
  background: transparent;
}

.el-menu--horizontal {
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #5e2c1a;
  --el-menu-active-color: #a03820;
  --el-menu-hover-bg-color: rgba(200, 60, 40, 0.1);
  --el-menu-hover-text-color: #a03820;
}

:deep(.el-menu--horizontal>.el-menu-item.is-active) {
  border-bottom: 3px solid #c33a2b;
  font-weight: 700;
}

/* 移动端隐藏文字 */
@media (max-width: 768px) {
  .brand-text {
    display: none;
  }
  .user-dropdown {
    right: 12px;
    width: auto;
    max-width: 90vw;
  }
  .navigation-menu {
    display: none !important;
  }
}

/* 用户区域 */
.user-area {
  display: flex;
  align-items: center;
  position: relative;
}

.kamihome-btn.login {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 8px 20px;
  color: #5e2c1a;
  font-weight: bold;
  box-shadow: 0 3px 0 #9b2a1a;
  transition: all 0.1s;
  width: auto;
  height: auto;
  white-space: nowrap;
}

.kamihome-btn.login:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a;
  background: #fce4d6;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 40px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.5);
  border: 1.5px solid #c33a2b;
  box-shadow: 0 2px 0 #9b2a1a;
}

.user-name {
  color: #5e2c1a;
  font-weight: 700;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 下拉菜单 */
.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 220px;
  background: #fef7f0;
  border-radius: 20px;
  box-shadow: 0 8px 0 #9b2a1a, 0 10px 20px rgba(160, 40, 20, 0.15);
  border: 2px solid #c33a2b;
  overflow: hidden;
  animation: dropdownSlide 0.2s ease;
  z-index: 1001;
}

@keyframes dropdownSlide {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.dropdown-header {
  padding: 14px 16px;
  background: #f5e6d3;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px dashed #c33a2b;
}

.dropdown-info {
  flex: 1;
}

.dropdown-name {
  font-weight: 700;
  color: #5e2c1a;
  font-size: 15px;
}

.dropdown-divider {
  height: 1px;
  background: #c33a2b;
  margin: 0;
}

.dropdown-menu {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #5e2c1a;
  font-weight: 500;
}

.dropdown-item:hover {
  background: #fce4d6;
}

.dropdown-item:last-child {
  color: #9b2a1a;
  border-top: 1px solid #c33a2b;
  background: #f0d8c0;
}

/* 移动端侧边栏 */
.mobile-sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(160, 40, 20, 0.15);
  backdrop-filter: blur(3px);
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.mobile-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  background: #fef7f0;
  border-right: 3px solid #c33a2b;
  box-shadow: 4px 0 0 #9b2a1a, 6px 0 15px rgba(0,0,0,0.1);
  animation: slideInLeft 0.25s ease;
  display: flex;
  flex-direction: column;
}

.mobile-sidebar.sidebar-closing {
  animation: slideOutLeft 0.25s ease;
}

.mobile-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  background: #f5e6d3;
  border-bottom: 2px solid #c33a2b;
  color: #5e2c1a;
  height: 60px;
}

.mobile-sidebar-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  text-shadow: 1px 1px 0 #f0d8c0;
}

.mobile-sidebar-menu {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes slideOutLeft {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

/* 平板端优化 */
@media (min-width: 769px) and (max-width: 1024px) {
  .navigation-menu {
    position: static;
    transform: none;
    flex: 1;
    margin: 0 20px;
  }
  .container {
    padding: 0 15px;
  }
}

/* 小屏手机 */
@media (max-width: 480px) {
  .kamihome-top-bar { height: 54px; }
  .container { padding: 0 12px; }
  .brand-text { font-size: 18px; }
  .user-info { padding: 6px 10px; }
  .user-dropdown { width: 200px; right: -8px; }
  .kamihome-btn.login { padding: 6px 16px; font-size: 14px; }
}
</style>

<!-- 全局样式：主题化下拉菜单及确认弹框 -->
<style>
/* 缘结下拉菜单 */
.kamihome-submenu {
  background: #fef7f0 !important;
  border: 2px solid #c33a2b !important;
  border-radius: 12px 12px 12px 6px !important;
  box-shadow: 0 5px 0 #9b2a1a, 0 8px 16px rgba(160, 60, 40, 0.1) !important;
  padding: 8px 0 !important;
  min-width: 140px !important;
}

/* 重置内部 el-menu 默认背景，避免重叠 */
.kamihome-submenu .el-menu--popup,
.kamihome-submenu .el-menu {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.kamihome-submenu .el-menu-item {
  background: transparent !important;
  color: #5e2c1a !important;
  font-weight: 600;
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
  height: 40px;
  line-height: 40px;
  margin: 2px 6px;
  border-radius: 20px;
  transition: all 0.15s;
}

.kamihome-submenu .el-menu-item:hover {
  background: #fce4d6 !important;
  color: #a03820 !important;
}

.kamihome-submenu .el-menu-item.is-active {
  color: #c33a2b !important;
  background: rgba(200, 60, 40, 0.1) !important;
}

/* 主题化退出登录弹框 */
.kamihome-message-box {
  background: #fef7f0 !important;
  border: 3px solid #c33a2b !important;
  border-radius: 20px !important;
  box-shadow: 0 6px 0 #9b2a1a !important;
  padding: 0 !important;
}

.kamihome-message-box .el-message-box__header {
  padding: 20px 24px 16px;
  border-bottom: 2px dashed #c33a2b;
}

.kamihome-message-box .el-message-box__title {
  color: #5e2c1a;
  font-weight: 700;
  font-size: 18px;
}

.kamihome-message-box .el-message-box__content {
  padding: 20px 24px;
  color: #3a2214;
  font-size: 15px;
}

.kamihome-message-box .el-message-box__btns {
  padding: 12px 24px 20px;
}

.kamihome-message-box .el-button {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 8px 20px;
  font-weight: bold;
  color: #5e2c1a;
  box-shadow: 0 3px 0 #9b2a1a;
  transition: all 0.1s;
}

.kamihome-message-box .el-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 #9b2a1a;
  background: #fce4d6;
}

.kamihome-message-box .el-button--primary {
  background: #c33a2b;
  border-color: #a03020;
  color: #fff5e0;
  box-shadow: 0 3px 0 #7a1e10;
}

.kamihome-message-box .el-button--primary:hover {
  background: #d44c3a;
  box-shadow: 0 5px 0 #7a1e10;
}

.kamihome-message-box .el-button--danger {
  background: #c33a2b;
  border-color: #a03020;
  color: #fff5e0;
}
</style>