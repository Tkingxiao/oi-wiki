<script setup>
import { ref, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, ArrowRight, ArrowLeft, Message } from '@element-plus/icons-vue'
import { sendVerification, verifyCode, register } from '@/api/auth'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const loginForm = reactive({
  email: '',
  password: ''
})

const bindForm = reactive({
  bilibili_uid: '',
  email: '',
  password: '',
  confirmPassword: '',
  verificationCode: ''
})

const loginFormRef = ref(null)
const bindFormRef = ref(null)

const loading = ref(false)

const isHovered = ref(false)
const isLoginMode = ref(true)
const sendingCode = ref(false)
const codeCountdown = ref(0)
const codeButtonText = ref('发送验证码')
const verificationSent = ref(false)

// 登录表单验证规则
const loginRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '请输入正确的邮箱格式',
      trigger: 'blur'
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度不能少于8位', trigger: 'blur' }
  ]
}

const passwordRegex = /^(?=.*[0-9])(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,12}$/

const bindRules = {
  bilibili_uid: [
    { required: true, message: '请输入B站UID', trigger: 'blur' },
    { pattern: /^\d+$/, message: 'B站UID必须为纯数字', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '请输入正确的邮箱格式',
      trigger: 'blur'
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { validator: (rule, value, callback) => {
        if (!passwordRegex.test(value)) {
          callback(new Error('密码必须为8-12位，包含数字、字母和特殊符号'))
        } else {
          callback()
        }
      }, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== bindForm.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  verificationCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    {
      validator: async (rule, value, callback) => {
        if (verificationSent.value && value && value.length > 0) {
          try {
            await verifyCode(bindForm.email, value)
            callback()
          } catch (error) {
            callback(new Error('验证码错误，请输入正确的验证码'))
          }
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()
    loading.value = true

    await userStore.login(loginForm.email, loginForm.password)

    ElMessage.success('参拜成功！欢迎回到神社~')
    await nextTick()

    if (window.history.length > 1) {
      router.go(-1)
    } else {
      router.replace('/')
    }
  } catch (error) {
    ElMessage.error('参拜失败，请检查神谕与神印是否正确~')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!bindFormRef.value) return

  try {
    await bindFormRef.value.validate()

    loading.value = true

    await register(
      bindForm.bilibili_uid,
      bindForm.email,
      bindForm.password,
      bindForm.verificationCode
    )

    ElMessage.success('氏子入社成功！快去参拜吧~')
    isLoginMode.value = true
    bindForm.bilibili_uid = ''
    bindForm.email = ''
    bindForm.password = ''
    bindForm.confirmPassword = ''
    bindForm.verificationCode = ''
    codeCountdown.value = 0
    codeButtonText.value = '发送验证码'
    verificationSent.value = false
  } catch (error) {
    ElMessage.error('入社失败，请检查奉纳信息~')
  } finally {
    loading.value = false
  }
}

const sendVerificationCode = async () => {
  if (!bindForm.email) {
    ElMessage.warning('请输入邮箱地址')
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(bindForm.email)) {
    ElMessage.warning('请输入正确的邮箱格式')
    return
  }

  if (codeCountdown.value > 0) return

  sendingCode.value = true

  try {
    await sendVerification(bindForm.email)

    ElMessage.success('神谕已发送，请查收邮件')

    verificationSent.value = true

    codeCountdown.value = 60
    startCountdown()
  } catch (error) {
    ElMessage.error('神谕发送失败，请重试')
  } finally {
    sendingCode.value = false
  }
}

const startCountdown = () => {
  const timer = setInterval(() => {
    codeCountdown.value--
    codeButtonText.value = `${codeCountdown.value}s`

    if (codeCountdown.value <= 0) {
      clearInterval(timer)
      codeButtonText.value = '发送验证码'
      codeCountdown.value = 0
    }
  }, 1000)
}

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  bindForm.bilibili_uid = ''
  bindForm.email = ''
  bindForm.password = ''
  bindForm.confirmPassword = ''
  bindForm.verificationCode = ''
  codeCountdown.value = 0
  codeButtonText.value = '发送验证码'
  verificationSent.value = false
}

const goBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="kamihome-login-container">
    <div class="login-box" :class="{ 'animate-in': true, 'hover': isHovered }" @mouseenter="isHovered = true"
      @mouseleave="isHovered = false">

      <div class="back-button-container">
        <el-button class="back-button kamihome-btn small" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回本殿
        </el-button>
      </div>

      <div class="login-header">
        <h2>⛩️ 黛棠神社 ⛩️</h2>
        <p>{{ isLoginMode ? '神使归来，恭迎参拜' : '缔结良缘，成为氏子' }}</p>
      </div>

      <div class="form-container" :class="{ 'flipped': !isLoginMode }"
        :style="{ height: isLoginMode ? '160px' : '360px' }">
        <div class="form-card">
          <!-- 登录表单 -->
          <el-form class="login-form" ref="loginFormRef" :model="loginForm" :rules="loginRules">
            <el-form-item prop="email">
              <el-input v-model="loginForm.email" placeholder="神使邮箱" :prefix-icon="Message" clearable />
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="loginForm.password" type="password" placeholder="神印（密码）" :prefix-icon="Lock"
                show-password clearable />
            </el-form-item>
            <el-button type="danger" class="login-button kamihome-btn" :loading="loading" @click="handleLogin">
              参拜
              <el-icon class="button-icon"><ArrowRight /></el-icon>
            </el-button>
          </el-form>

          <!-- 注册表单 -->
          <el-form class="register-form" ref="bindFormRef" :model="bindForm" :rules="bindRules">
            <el-form-item prop="bilibili_uid">
              <el-input v-model="bindForm.bilibili_uid" placeholder="B站UID（神使编号）" :prefix-icon="User" clearable />
            </el-form-item>

            <div class="email-row">
              <el-form-item prop="email" class="email-item">
                <el-input v-model="bindForm.email" placeholder="神使邮箱" :prefix-icon="Message" clearable />
              </el-form-item>
              <el-button class="send-code-btn kamihome-btn small" :loading="sendingCode" :disabled="codeCountdown > 0"
                @click.prevent="sendVerificationCode">
                {{ codeButtonText }}
              </el-button>
            </div>

            <el-form-item prop="verificationCode">
              <el-input v-model="bindForm.verificationCode" placeholder="神谕（验证码）" :prefix-icon="Lock" clearable />
            </el-form-item>

            <el-form-item prop="password">
              <el-input v-model="bindForm.password" type="password" placeholder="神印（8-12位，含数字字母符号）" :prefix-icon="Lock"
                show-password clearable />
            </el-form-item>
            <el-form-item prop="confirmPassword">
              <el-input v-model="bindForm.confirmPassword" type="password" placeholder="确认神印" :prefix-icon="Lock"
                show-password clearable />
            </el-form-item>
            <el-button type="danger" class="register-button kamihome-btn" :loading="loading" @click="handleRegister">
              缔结良缘
              <el-icon class="button-icon"><ArrowRight /></el-icon>
            </el-button>
          </el-form>
        </div>
      </div>

      <div class="mode-switch">
        <el-button class="switch-button kamihome-btn small" @click="toggleMode">
          {{ isLoginMode ? '尚无神籍？成为氏子' : '已有神籍？返回参拜' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 元气少女缘结神主题 ==================== */
.kamihome-login-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
}

.login-box {
  width: 100%;
  max-width: 420px;
  padding: 50px 40px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(8px);
  border: 2px solid #c33a2b;
  border-radius: 24px 24px 24px 8px;
  box-shadow: 0 8px 0 #9b2a1a, 0 15px 30px rgba(160, 60, 40, 0.15);
  position: relative;
  z-index: 1;
  transform: translateY(30px) scale(0.95);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  margin: 20px;
  box-sizing: border-box;
}

.login-box::after {
  content: '🦊';
  position: absolute;
  bottom: 10px;
  right: 20px;
  font-size: 18px;
  color: #c33a2b;
  opacity: 0.25;
}

.login-box.animate-in {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.login-box.hover {
  box-shadow: 0 10px 0 #9b2a1a, 0 20px 40px rgba(160, 60, 40, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 35px;
}

.login-header h2 {
  font-size: 30px;
  color: #5e2c1a;
  margin: 0 0 12px 0;
  font-weight: 700;
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 #f0d8c0;
}

.login-header p {
  font-size: 15px;
  color: #7a3a28;
  margin: 0;
  font-weight: 500;
  font-style: italic;
}

.form-container {
  position: relative;
  width: 100%;
  perspective: 1000px;
  transition: all 0.3s ease;
}

.form-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform-origin: center center;
  transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.form-container.flipped .form-card {
  transform: rotateY(180deg);
}

.login-form,
.register-form {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

.register-form {
  transform: rotateY(180deg);
}

.email-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.email-item {
  flex: 1;
}

/* 按钮样式 - 御守风格 */
.kamihome-btn {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 10px 24px;
  font-size: 15px;
  font-weight: bold;
  color: #5e2c1a;
  box-shadow: 0 4px 0 #9b2a1a;
  cursor: pointer;
  transition: all 0.1s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.kamihome-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 #9b2a1a;
  background: #fce4d6;
}

.kamihome-btn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #9b2a1a;
}

.kamihome-btn.small {
  padding: 6px 16px;
  font-size: 14px;
}

.send-code-btn {
  min-width: 100px;
  white-space: nowrap;
}

.login-button,
.register-button {
  width: 100%;
  margin-top: 16px;
}

.back-button-container {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
}

.back-button {
  padding: 6px 14px;
}

.mode-switch {
  text-align: center;
  padding-top: 20px;
  margin-top: 10px;
  border-top: 2px dashed #c33a2b;
}

.switch-button {
  background: transparent;
  border: 1.5px dashed #c33a2b;
  color: #5e2c1a;
  box-shadow: none;
}

.switch-button:hover {
  background: #fce4d6;
  border-style: solid;
}

/* 输入框主题化 */
:deep(.el-input__wrapper) {
  background: #fef7f0;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);
}

:deep(.el-input__wrapper:hover) {
  border-color: #a03820;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #a03820;
  box-shadow: 0 0 0 2px rgba(200, 60, 40, 0.2);
}

:deep(.el-input__inner) {
  color: #3a2214;
}

:deep(.el-input__inner::placeholder) {
  color: #9b8a7a;
}

/* 表单验证错误样式保持可用 */
:deep(.el-form-item.is-error .el-input__wrapper) {
  border-color: #f56c6c;
}
</style>