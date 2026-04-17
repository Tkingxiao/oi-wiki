import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, refreshToken as refreshTokenApi } from '@/api/auth'

const TOKEN_KEY = 'oi_token'
const USER_KEY = 'oi_user'

const fixAvatarUrl = (url) => {
  if (!url) return ''
  return url.replace(/^http:\/\//, 'https://')
}

export const useUserStore = defineStore('user', () => {
    const token = ref(localStorage.getItem(TOKEN_KEY) || '')
    const user = ref(null)
    const isLoggedIn = ref(false)

    // 初始化时从 localStorage 恢复并转换权限和头像
    const storedUser = localStorage.getItem(USER_KEY)
    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser)
            if (parsed) {
                parsed.permission = Number(parsed.permission) ?? 3
                // 如果旧数据没有 id，尝试从其他字段补救
                if (!parsed.id && parsed.user_id) parsed.id = parsed.user_id
                if (!parsed.id && parsed.userId) parsed.id = parsed.userId
                user.value = parsed
            }
        } catch(e) {}
    }

    const permission = computed(() => {
        const p = user.value?.permission
        return typeof p === 'number' ? p : (p ? Number(p) : 3)
    })
    const username = computed(() => user.value?.name || '')
    const userAvatar = computed(() => user.value?.avatar || '')
    const isAuthenticated = computed(() => !!token.value && !!user.value)

    const login = async (accountNumber, password) => {
        try {
            const response = await loginApi(accountNumber, password)
            const tokenValue = response.data.token
            // 关键修复：从响应中提取 id（兼容多种字段名）
            const userId = response.data.id || response.data.user_id || response.data.userId
            const userData = {
                id: userId,  // 必须保存 id
                name: response.data.name,
                permission: Number(response.data.permission),
                avatar: fixAvatarUrl(response.data.avatar),
                bilibili_uid: response.data.bilibili_uid
            }
            setToken(tokenValue)
            setUser(userData)
            isLoggedIn.value = true
            return response.data
        } catch (error) {
            logout()
            throw error
        }
    }

    const refreshToken = async () => {
        if (!token.value) throw new Error('没有可用的token')
        try {
            const response = await refreshTokenApi(token.value)
            setToken(response.data.token)
            return response
        } catch (error) {
            logout()
            throw error
        }
    }

    const setToken = (tokenValue) => {
        token.value = tokenValue
        if (tokenValue) localStorage.setItem(TOKEN_KEY, tokenValue)
        else localStorage.removeItem(TOKEN_KEY)
    }

    const setUser = (userInfo) => {
        if (userInfo) {
            const processed = { 
                ...userInfo, 
                permission: Number(userInfo.permission) ?? 3,
                avatar: fixAvatarUrl(userInfo.avatar)
            }
            // 确保 id 存在
            if (!processed.id && userInfo.user_id) processed.id = userInfo.user_id
            if (!processed.id && userInfo.userId) processed.id = userInfo.userId
            user.value = processed
            localStorage.setItem(USER_KEY, JSON.stringify(processed))
        } else {
            user.value = null
            localStorage.removeItem(USER_KEY)
        }
    }

    // 更新头像
    const setAvatar = (avatarUrl) => {
        if (user.value) {
            user.value.avatar = fixAvatarUrl(avatarUrl)
            localStorage.setItem(USER_KEY, JSON.stringify(user.value))
        }
    }

    const logout = () => {
        token.value = ''
        user.value = null
        isLoggedIn.value = false
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
    }

    const initializeAuth = async () => {
        const storedToken = localStorage.getItem(TOKEN_KEY)
        const storedUser = localStorage.getItem(USER_KEY)
        if (storedToken && storedUser) {
            try {
                const parsed = JSON.parse(storedUser)
                if (parsed) {
                    parsed.permission = Number(parsed.permission) ?? 3
                    if (!parsed.id && parsed.user_id) parsed.id = parsed.user_id
                    if (!parsed.id && parsed.userId) parsed.id = parsed.userId
                    user.value = parsed
                }
                token.value = storedToken
                isLoggedIn.value = true
                await refreshToken()
            } catch (error) {
                console.warn('token刷新失败:', error)
                logout()
            }
        }
    }

    return {
        token,
        user,
        isLoggedIn,
        permission,
        username,
        userAvatar,
        isAuthenticated,
        login,
        refreshToken,
        setToken,
        setUser,
        setAvatar,
        logout,
        initializeAuth
    }
})