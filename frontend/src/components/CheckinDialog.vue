<template>
  <el-dialog v-model="visible" title="⛩️ 今日参拜" width="480px" :close-on-click-modal="false" custom-class="kamihome-dialog">
    <div class="mood-section">
      <div class="label">🦊 今日心境</div>
      <div class="mood-list">
        <el-radio-group v-model="selectedMood">
          <el-radio v-for="item in moodOptions" :key="item.value" :label="item.value" class="mood-radio">
            <span class="mood-emoji">{{ item.emoji }}</span>
            <span class="mood-label">{{ item.label }}</span>
          </el-radio>
        </el-radio-group>
      </div>
    </div>
    <div class="message-section">
      <div class="label">📜 绘马祈愿（选填，最多50字）</div>
      <el-input
        type="textarea"
        v-model="message"
        maxlength="50"
        show-word-limit
        rows="3"
        placeholder="写下今日心愿..."
        class="message-input"
      />
    </div>
    <template #footer>
      <el-button @click="visible = false" class="kamihome-btn">取消</el-button>
      <el-button type="danger" @click="submitCheckin" :loading="submitting" class="kamihome-btn">奉纳参拜</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const visible = ref(false)
const selectedMood = ref('')
const message = ref('')
const submitting = ref(false)

const moodOptions = [
  { value: 'happy', label: '喜悦', emoji: '😊' },
  { value: 'excited', label: '兴奋', emoji: '🎉' },
  { value: 'tired', label: '疲惫', emoji: '😴' },
  { value: 'struggle', label: '精进', emoji: '💪' },
  { value: 'sad', label: '忧愁', emoji: '😢' },
]

const open = () => {
  selectedMood.value = ''
  message.value = ''
  visible.value = true
}

const submitCheckin = async () => {
  if (!selectedMood.value) {
    ElMessage.warning('请选择今日心境')
    return
  }
  submitting.value = true
  try {
    const token = localStorage.getItem('oi_token')
    await axios.post('/api/checkin', {
      mood: selectedMood.value,
      message: message.value
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    ElMessage.success('参拜成功，愿神明护佑！')
    visible.value = false
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '参拜失败，请稍后再试')
  } finally {
    submitting.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
/* 对话框整体主题（通过 custom-class 配合全局样式，此处写局部样式） */
.mood-section {
  margin-bottom: 20px;
}

.label {
  font-size: 15px;
  font-weight: 700;
  color: #5e2c1a;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-left: 4px solid #c33a2b;
  padding-left: 12px;
}

.mood-list {
  padding: 8px 0;
}

.mood-radio {
  display: flex;
  align-items: center;
  margin: 10px 0;
  padding: 6px 12px;
  border-radius: 30px;
  background: rgba(245, 230, 211, 0.3);
  border: 1px solid rgba(200, 60, 40, 0.2);
  transition: all 0.15s;
}

.mood-radio:hover {
  background: #fce4d6;
  border-color: #c33a2b;
}

.mood-radio :deep(.el-radio__label) {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding-left: 8px;
}

.mood-emoji {
  font-size: 24px;
  width: 36px;
  text-align: center;
}

.mood-label {
  font-size: 16px;
  font-weight: 600;
  color: #5e2c1a;
}

.message-section {
  margin-top: 16px;
}

.message-input :deep(.el-textarea__inner) {
  background: #fef7f0;
  border: 1.5px solid #c33a2b;
  border-radius: 16px;
  color: #3a2214;
  font-family: 'Noto Serif JP', serif;
  resize: none;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);
}

.message-input :deep(.el-textarea__inner:focus) {
  border-color: #a03820;
}

.message-input :deep(.el-input__count) {
  color: #7a3a28;
}

/* 按钮样式（与全局 kamihome-btn 一致） */
.kamihome-btn {
  background: #f5e6d3;
  border: 1.5px solid #c33a2b;
  border-radius: 30px;
  padding: 8px 20px;
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

/* 配合全局对话框样式，这里只做局部覆盖 */
:deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #c33a2b;
  border-color: #c33a2b;
}

:deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #c33a2b;
}
</style>