<template>
  <div class="kamihome-gaga-page">
    <div class="container">
      <!-- 发布绘马（动态）表单 -->
      <div class="post-form kamihome-card">
        <!-- 神社风格表单头部 -->
        <div class="form-header shrine-header">
          <span class="header-icon">🦊</span>
          <span class="header-text">奉纳绘马</span>
          <span class="header-icon">⛩️</span>
        </div>
        <div
          ref="editorRef"
          class="rich-editor"
          contenteditable="true"
          @input="onEditorInput"
          @paste="onEditorPaste"
          placeholder="写下你的心愿..."
        ></div>
        <div class="image-upload">
          <div class="image-list" v-if="newPostImages.length">
            <div v-for="(img, idx) in newPostImages" :key="idx" class="image-item">
              <img :src="img.url" />
              <el-icon class="remove" @click="removeImage(idx)"><CircleClose /></el-icon>
            </div>
          </div>
          <div class="action-buttons">
            <el-upload
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="handlePostImageChange"
              multiple
              accept="image/*"
              :limit="9"
            >
              <el-button size="small" class="kamihome-btn small icon-button">
                <img src="/images/icons/image.png" class="action-icon" alt="绘马" />
              </el-button>
            </el-upload>
            <el-button size="small" @click.stop="toggleEmojiPanel" ref="emojiButtonRef" class="kamihome-btn small icon-button">
              <img src="/images/icons/emoji.png" class="action-icon" alt="表情" />
            </el-button>
          </div>
        </div>
        <div class="form-actions">
          <el-button type="danger" @click="submitPost" :loading="submitting" class="kamihome-btn">奉纳绘马</el-button>
        </div>
      </div>

      <!-- 绘马（动态）列表 -->
      <div class="posts-list">
        <div v-for="post in posts" :key="post.id" class="post-card kamihome-card">
          <div class="post-header">
            <Avatar :src="post.user_avatar" width="40" height="40" />
            <div class="user-info">
              <span class="name">{{ post.user_name }}</span>
              <UserBadge :level="post.medal_level || 0" :badge="post.badge || '未上供'" />
              <span class="time">{{ formatTime(post.created_at) }}</span>
            </div>
            <el-dropdown v-if="canDeletePost(post)" trigger="click" @command="() => confirmDeletePost(post.id)">
              <el-icon class="more-icon"><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="post-content">
            <div v-html="post.content"></div>
          </div>
          <div class="post-images" v-if="post.images && post.images.length">
            <div v-for="(img, idx) in post.images" :key="idx" class="post-image">
              <img :src="img" @click="previewImage(img, post.images, idx)" />
            </div>
          </div>
          <div class="post-stats">
            <div class="action-item" @click="openForwardDialog(post)">
              <img src="/images/icons/forward.png" class="action-icon" alt="传颂" />
              <span>{{ post.forward_count || 0 }}</span>
            </div>
            <div class="action-item" @click="toggleComments(post.id)">
              <img src="/images/icons/comment.png" class="action-icon" alt="祝词" />
              <span>{{ post.comments.length }}</span>
            </div>
            <div class="action-item" @click="toggleLike(post)">
              <img :src="post.liked ? '/images/icons/liked.png' : '/images/icons/like.png'" class="action-icon" alt="结缘" />
              <span>{{ post.like_count || 0 }}</span>
            </div>
          </div>

          <!-- 祝词（评论）区域 -->
          <div class="comments-area" v-if="expandedComments === post.id">
            <div class="comment-list">
              <div v-for="comment in post.comments" :key="comment.id" class="comment-item">
                <Avatar :src="comment.user_avatar" width="24" height="24" />
                <div class="comment-content-wrapper">
                  <div class="comment-user-info">
                    <span class="comment-user">{{ comment.user_name }}</span>
                    <UserBadge :level="comment.medal_level || 0" :badge="comment.badge || '未上供'" />
                  </div>
                  <div class="comment-content" v-html="comment.content"></div>
                  <div v-if="comment.image_url" class="comment-image" @click="previewImage(comment.image_url, [comment.image_url], 0)">
                    <img :src="comment.image_url" />
                  </div>
                  <div class="comment-meta">
                    <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
                    <span class="comment-like" @click="toggleCommentLike(comment, post)">
                      <img :src="comment.comment_liked ? '/images/icons/liked.png' : '/images/icons/like.png'" class="action-icon-small" alt="结缘" />
                      <span>{{ comment.comment_like_count || 0 }}</span>
                    </span>
                  </div>
                </div>
                <el-dropdown v-if="canDeleteComment(comment)" trigger="click" @command="() => deleteComment(comment.id, post.id)">
                  <el-icon class="more-icon-small"><MoreFilled /></el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <!-- 祝词输入框 -->
              <div class="comment-input-wrapper" :data-post-id="post.id">
                <div
                  :ref="el => setCommentEditorRef(el, post.id)"
                  class="rich-editor comment-editor"
                  contenteditable="true"
                  @input="onCommentInput($event, post.id)"
                  @paste="onCommentPaste"
                  placeholder="写下你的祝词..."
                ></div>
                <div class="comment-image-upload" v-if="commentImages[post.id] && commentImages[post.id].length">
                  <div v-for="(img, idx) in commentImages[post.id]" :key="idx" class="image-item small">
                    <img :src="img.url" />
                    <el-icon class="remove" @click="removeCommentImage(post.id, idx)"><CircleClose /></el-icon>
                  </div>
                </div>
                <div class="comment-actions">
                  <el-upload
                    action="#"
                    :auto-upload="false"
                    :show-file-list="false"
                    :on-change="(file) => handleCommentImageChange(file, post.id)"
                    accept="image/*"
                  >
                    <el-button size="small" class="kamihome-btn small icon-button">
                      <img src="/images/icons/image.png" class="action-icon" alt="绘马" />
                    </el-button>
                  </el-upload>
                  <el-button size="small" @click.stop="toggleCommentEmojiPanel(post.id)" :data-post-id="post.id" class="kamihome-btn small icon-button comment-emoji-btn">
                    <img src="/images/icons/emoji.png" class="action-icon" alt="表情" />
                  </el-button>
                  <el-button type="danger" size="small" @click="submitComment(post.id)" class="kamihome-btn small">奉纳</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览器 -->
    <el-image-viewer
      v-if="imageViewerVisible"
      :url-list="previewImageList"
      :initial-index="previewImageIndex"
      @close="imageViewerVisible = false"
    />

    <!-- 传颂（转发）对话框 -->
    <el-dialog v-model="forwardDialogVisible" title="传颂绘马" width="500px" custom-class="kamihome-dialog">
      <el-input
        type="textarea"
        v-model="forwardMessage"
        rows="3"
        placeholder="说点什么吧...（可选）"
        :maxlength="maxLength"
        show-word-limit
      ></el-input>
      <template #footer>
        <el-button @click="forwardDialogVisible = false" class="kamihome-btn">取消</el-button>
        <el-button type="danger" @click="submitForward" :loading="forwarding" class="kamihome-btn">传颂</el-button>
      </template>
    </el-dialog>

    <!-- 全局表情面板 -->
    <div v-if="emojiPanelVisible" class="emoji-panel-wrapper" :style="emojiPanelStyle" @click.stop>
      <div class="emoji-panel">
        <el-tabs v-model="activeEmojiTab">
          <el-tab-pane label="默认表情" name="default">
            <div class="recent-emojis" v-if="recentEmojis.length">
              <div class="recent-title">最近表情</div>
              <div class="recent-grid">
                <div v-for="(item, idx) in recentEmojis" :key="idx" class="recent-emoji-item" @click="insertRecentEmoji(item)">
                  <span v-if="item.type === 'text'">{{ item.value }}</span>
                  <img v-else :src="item.value" />
                </div>
              </div>
            </div>
            <div class="emoji-grid">
              <div v-for="(item, idx) in defaultEmojis" :key="idx" class="emoji-item-custom" @click="insertImageEmoji(item.img)">
                <img :src="item.img" style="width:25px; height:25px;" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="oi酱" name="custom1">
            <div class="emoji-grid">
              <div v-for="(item, idx) in customEmojis1" :key="idx" class="emoji-item-custom" @click="insertImageEmoji(item.img)">
                <img :src="item.img" style="width:25px; height:25px;" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="黛皇酱" name="custom2">
            <div class="emoji-grid">
              <div v-for="(item, idx) in customEmojis2" :key="idx" class="emoji-item-custom" @click="insertImageEmoji(item.img)">
                <img :src="item.img" style="width:25px; height:25px;" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="我的收藏" name="favorite">
            <div class="favorite-header">
              <el-button size="small" type="danger" @click="addFavoriteEmoji" class="kamihome-btn small">+ 添加收藏</el-button>
              <span class="favorite-tip">（最多10个，右键/长按删除）</span>
            </div>
            <div class="emoji-grid favorite-grid" v-if="favoriteEmojis.length">
              <div v-for="(url, idx) in favoriteEmojis" :key="idx" class="emoji-item-custom favorite-item"
                   @click="insertImageEmoji(url)"
                   @contextmenu.prevent="deleteFavoriteEmoji(url, $event)"
                   @touchstart="onTouchStartFavorite($event, url)"
                   @touchend="onTouchEndFavorite">
                <img :src="url" style="width:60px; height:60px; object-fit: contain;" />
              </div>
            </div>
            <div v-else class="empty-favorite">暂无收藏，点击"+ 添加收藏"上传表情包</div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <!-- 评论表情面板（页面级别，独立DOM） -->
    <div v-if="commentEmojiPanelVisible" class="emoji-panel-wrapper comment-emoji-panel" :style="commentEmojiPanelStyle" @click.stop>
      <div class="emoji-panel">
        <el-tabs v-model="activeEmojiTab">
          <el-tab-pane label="默认表情" name="default">
            <div class="recent-emojis" v-if="recentEmojis.length">
              <div class="recent-title">最近表情</div>
              <div class="recent-grid">
                <div v-for="(item, idx) in recentEmojis" :key="idx" class="recent-emoji-item" @click="insertCommentRecentEmoji(commentEmojiPanelVisible, item)">
                  <span v-if="item.type === 'text'">{{ item.value }}</span>
                  <img v-else :src="item.value" />
                </div>
              </div>
            </div>
            <div class="emoji-grid">
              <div v-for="(item, idx) in defaultEmojis" :key="idx" class="emoji-item-custom" @click="insertCommentImageEmoji(commentEmojiPanelVisible, item.img)">
                <img :src="item.img" style="width:25px; height:25px;" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="oi酱" name="custom1">
            <div class="emoji-grid">
              <div v-for="(item, idx) in customEmojis1" :key="idx" class="emoji-item-custom" @click="insertCommentImageEmoji(commentEmojiPanelVisible, item.img)">
                <img :src="item.img" style="width:25px; height:25px;" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="黛皇酱" name="custom2">
            <div class="emoji-grid">
              <div v-for="(item, idx) in customEmojis2" :key="idx" class="emoji-item-custom" @click="insertCommentImageEmoji(commentEmojiPanelVisible, item.img)">
                <img :src="item.img" style="width:25px; height:25px;" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="我的收藏" name="favorite">
            <div class="favorite-header">
              <el-button size="small" type="danger" @click="addFavoriteEmoji" class="kamihome-btn small">+ 添加收藏</el-button>
              <span class="favorite-tip">（最多10个，右键/长按删除）</span>
            </div>
            <div class="emoji-grid favorite-grid" v-if="favoriteEmojis.length">
              <div v-for="(url, idx) in favoriteEmojis" :key="idx" class="emoji-item-custom favorite-item"
                   @click="insertCommentImageEmoji(commentEmojiPanelVisible, url)"
                   @contextmenu.prevent="deleteFavoriteEmoji(url, $event)"
                   @touchstart="onTouchStartFavorite($event, url)"
                   @touchend="onTouchEndFavorite">
                <img :src="url" style="width:60px; height:60px; object-fit: contain;" />
              </div>
            </div>
            <div v-else class="empty-favorite">暂无收藏，点击"+ 添加收藏"上传表情包</div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, MoreFilled } from '@element-plus/icons-vue'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import UserBadge from '@/components/UserBadge.vue'
import Avatar from '@/components/Avatar.vue'

const router = useRouter()
const userStore = useUserStore()
const { user, isAuthenticated } = storeToRefs(userStore)

const getPlainText = (html) => {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}
const formatTime = (timestamp) => {
  const date = new Date(timestamp * 1000), now = new Date(), diff = now - date
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${date.getMonth()+1}月${date.getDate()}日`
}
const userPermission = computed(() => user.value?.permission)
const isAdmin = computed(() => {
  const perm = userPermission.value
  return perm === 0 || perm === 1 || perm === 2
})
const maxLength = computed(() => isAdmin.value ? Infinity : 1000)

const posts = ref([])
const newPostImages = ref([])
const submitting = ref(false)
let savedRange = null

const saveSelection = () => {
  const sel = window.getSelection()
  if (sel.rangeCount > 0 && editorRef.value) {
    const range = sel.getRangeAt(0)
    const commonAncestor = range.commonAncestorContainer
    if (editorRef.value.contains(commonAncestor) || editorRef.value === commonAncestor) {
      savedRange = range.cloneRange()
    }
  }
}

const editorRef = ref(null)
const handlePostImageChange = (file) => {
  if (file.raw.size > 3 * 1024 * 1024) { ElMessage.warning('绘马不能超过3MB'); return }
  const url = URL.createObjectURL(file.raw)
  newPostImages.value.push({ file: file.raw, url })
}
const removeImage = (idx) => {
  URL.revokeObjectURL(newPostImages.value[idx].url)
  newPostImages.value.splice(idx, 1)
}
const limitEditorLength = (editor) => {
  const text = editor.innerText || editor.textContent || ''
  if (!isAdmin.value && text.length > maxLength.value) {
    editor.innerText = text.slice(0, maxLength.value)
    const range = document.createRange(), sel = window.getSelection()
    range.selectNodeContents(editor); range.collapse(false)
    sel.removeAllRanges(); sel.addRange(range)
    ElMessage.warning(`内容不能超过${maxLength.value}字`)
    return false
  }
  return true
}
const onEditorInput = () => {
  if (editorRef.value) {
    limitEditorLength(editorRef.value)
    saveSelection()
  }
}
const onEditorPaste = (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }

const ensureEditorCursor = () => {
  const editor = editorRef.value
  if (!editor) return false
  editor.focus()
  const selection = window.getSelection()
  if (!selection.rangeCount) {
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) {
    const newRange = document.createRange()
    newRange.selectNodeContents(editor)
    newRange.collapse(false)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }
  return true
}

const insertAtCursor = (html, isPlainText = false) => {
  setTimeout(() => {
    const editor = editorRef.value
    if (!editor) return
    if (document.activeElement !== editor) editor.focus()
    const sel = window.getSelection()
    if (savedRange) {
      try {
        if (editor.contains(savedRange.commonAncestorContainer)) {
          sel.removeAllRanges()
          sel.addRange(savedRange)
        }
      } catch (e) {}
    }
    if (isPlainText) document.execCommand('insertText', false, html)
    else document.execCommand('insertHTML', false, html)
    saveSelection()
  }, 0)
}

const insertEmoji = (emoji) => {
  if (!editorRef.value) return
  ensureEditorCursor()
  addToRecent({ type: 'text', value: emoji })
  insertAtCursor(emoji, true)
}
const insertImageEmoji = (imgUrl) => {
  if (!imgUrl || !editorRef.value) return
  ensureEditorCursor()
  addToRecent({ type: 'image', value: imgUrl })
  const imgHtml = `<img src="${imgUrl}" class="inline-emoji" style="width:25px;height:25px;vertical-align:middle;margin:0 2px;" />`
  insertAtCursor(imgHtml, false)
}
const insertRecentEmoji = (item) => {
  if (item.type === 'text') insertEmoji(item.value)
  else insertImageEmoji(item.value)
}
const submitPost = async () => {
  const htmlContent = editorRef.value?.innerHTML || ''
  const plainText = getPlainText(htmlContent)
  if (!plainText.trim() && newPostImages.value.length === 0) {
    ElMessage.warning('请写下心愿或奉纳绘马')
    return
  }
  if (!isAdmin.value && plainText.length > maxLength.value) {
    ElMessage.warning(`心愿不能超过${maxLength.value}字`)
    return
  }
  submitting.value = true
  const formData = new FormData()
  formData.append('content', htmlContent)
  for (let img of newPostImages.value) formData.append('images', img.file)
  try {
    const token = localStorage.getItem('oi_token')
    await axios.post('/api/chatRoom/post', formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('绘马已奉纳')
    if (editorRef.value) editorRef.value.innerHTML = ''
    newPostImages.value = []
    fetchPosts()
  } catch (err) { ElMessage.error(err.response?.data?.error || '奉纳失败') }
  finally { submitting.value = false }
}

const fetchPosts = async () => {
  try {
    const res = await axios.get('/api/chatRoom/posts')
    posts.value = res.data
  } catch (err) { ElMessage.error('加载绘马失败') }
}
const toggleLike = async (post) => {
  if (!isAuthenticated.value) { ElMessage.warning('请先参拜'); return }
  try {
    const token = localStorage.getItem('oi_token')
    const res = await axios.post(`/api/chatRoom/post/${post.id}/like`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (res.data.success) {
      post.liked = res.data.liked
      if (res.data.liked) { post.like_count = (post.like_count || 0) + 1; ElMessage.success('结缘成功') }
      else { post.like_count = (post.like_count || 0) - 1; ElMessage.success('已取消结缘') }
    }
  } catch (err) { ElMessage.error(err.response?.data?.error || '操作失败') }
}
const confirmDeletePost = (postId) => {
  ElMessageBox.confirm('绘马删除后将无法恢复，请谨慎操作', '要删除绘马吗？', {
    confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning'
  }).then(() => deletePost(postId)).catch(() => {})
}
const deletePost = async (postId) => {
  try {
    const token = localStorage.getItem('oi_token')
    await axios.delete(`/api/chatRoom/post/${postId}`, { headers: { Authorization: `Bearer ${token}` } })
    ElMessage.success('绘马已取下')
    posts.value = posts.value.filter(p => p.id !== postId)
  } catch (err) { ElMessage.error(err.response?.data?.error || '删除失败') }
}
const canDeletePost = (post) => {
  if (!isAuthenticated.value) return false
  if (!user.value) return false
  const currentId = user.value.id
  const postUserId = post.user_id
  const userPerm = Number(user.value.permission)
  if (userPerm === 0 || userPerm === 1 || userPerm === 2) return true
  return currentId && postUserId && String(currentId) === String(postUserId)
}

const forwardDialogVisible = ref(false)
const forwardMessage = ref('')
const forwarding = ref(false)
let currentForwardPost = null
const openForwardDialog = (post) => {
  if (!isAuthenticated.value) { ElMessage.warning('请先参拜'); return }
  currentForwardPost = post
  forwardMessage.value = ''
  forwardDialogVisible.value = true
}
const submitForward = async () => {
  if (!currentForwardPost) return
  forwarding.value = true
  try {
    const token = localStorage.getItem('oi_token')
    await axios.post(`/api/chatRoom/post/${currentForwardPost.id}/forward`, { forwardMessage: forwardMessage.value }, { headers: { Authorization: `Bearer ${token}` } })
    ElMessage.success('绘马已传颂')
    forwardDialogVisible.value = false
    fetchPosts()
  } catch (err) { ElMessage.error(err.response?.data?.error || '传颂失败') }
  finally { forwarding.value = false }
}

const commentContents = ref({})
const commentImages = ref({})
const commentEmojiPanelVisible = ref(null)
const commentEditors = ref({})
const commentEmojiPanelStyle = ref({})
const setCommentEditorRef = (el, postId) => { if (el) commentEditors.value[postId] = el }

const ensureCommentEditorCursorEnd = (postId) => {
  const editor = commentEditors.value[postId]
  if (!editor) return false
  editor.focus()
  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(editor)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}

const onCommentInput = (event, postId) => {
  const editor = event.target
  if (!limitEditorLength(editor)) return
  commentContents.value[postId] = editor.innerHTML
}
const onCommentPaste = (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }
const handleCommentImageChange = (file, postId) => {
  if (file.raw.size > 3 * 1024 * 1024) { ElMessage.warning('绘马不能超过3MB'); return }
  const url = URL.createObjectURL(file.raw)
  if (!commentImages.value[postId]) commentImages.value[postId] = []
  commentImages.value[postId].push({ file: file.raw, url })
}
const removeCommentImage = (postId, idx) => {
  URL.revokeObjectURL(commentImages.value[postId][idx].url)
  commentImages.value[postId].splice(idx, 1)
}
const updateCommentEmojiPanelPosition = (postId) => {
  const btn = document.querySelector(`.comment-emoji-btn[data-post-id="${postId}"]`)
  if (btn) {
    const rect = btn.getBoundingClientRect()
    const panelWidth = 350
    const panelHeight = 330 // 表情面板高度
    let left = rect.left
    
    if (left + panelWidth > window.innerWidth - 20) {
      left = window.innerWidth - panelWidth - 20
    }
    if (left < 20) left = 20
    
    // 判断按钮是否在屏幕上方1/3区域，如果是则显示在按钮下方，否则显示在上方
    const isInUpperThird = rect.top < window.innerHeight / 3
    
    if (isInUpperThird) {
      // 按钮在屏幕上方的1/3区域，面板显示在按钮下方
      commentEmojiPanelStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 5}px`,
        left: `${left}px`,
        zIndex: 9999
      }
    } else {
      // 按钮在屏幕中下方区域，面板显示在按钮上方
      commentEmojiPanelStyle.value = {
        position: 'fixed',
        top: `${rect.top - panelHeight}px`,
        left: `${left}px`,
        zIndex: 9999
      }
    }
  }
}
const toggleCommentEmojiPanel = (postId) => {
  if (commentEmojiPanelVisible.value === postId) commentEmojiPanelVisible.value = null
  else { updateCommentEmojiPanelPosition(postId); commentEmojiPanelVisible.value = postId }
}
const insertCommentEmoji = (postId, emoji) => {
  addToRecent({ type: 'text', value: emoji })
  
  const editor = commentEditors.value?.[postId]
  if (!editor) {
    console.warn('评论编辑器未找到:', postId)
    return
  }
  
  const tempInput = document.createElement('input')
  tempInput.style.position = 'absolute'
  tempInput.style.left = '-9999px'
  document.body.appendChild(tempInput)
  tempInput.focus()
  
  try {
    editor.innerHTML += emoji
    commentContents.value[postId] = editor.innerHTML
  } finally {
    document.body.removeChild(tempInput)
  }
}
const insertCommentImageEmoji = (postId, imgUrl) => {
  if (!imgUrl) return
  addToRecent({ type: 'image', value: imgUrl })
  
  const editor = commentEditors.value?.[postId]
  if (!editor) {
    console.warn('评论编辑器未找到:', postId)
    return
  }
  
  // 创建临时输入框来插入内容
  const tempInput = document.createElement('input')
  tempInput.style.position = 'absolute'
  tempInput.style.left = '-9999px'
  document.body.appendChild(tempInput)
  tempInput.focus()
  
  try {
    const imgHtml = `<img src="${imgUrl}" class="inline-emoji" style="width:25px;height:25px;vertical-align:middle;margin:0 2px;" />`
    editor.innerHTML += imgHtml
    commentContents.value[postId] = editor.innerHTML
  } finally {
    document.body.removeChild(tempInput)
  }
}
const insertCommentRecentEmoji = (postId, item) => {
  if (item.type === 'text') insertCommentEmoji(postId, item.value)
  else insertCommentImageEmoji(postId, item.value)
}
const submitComment = async (postId) => {
  const contentHtml = commentContents.value[postId] || ''
  const plainText = getPlainText(contentHtml)
  if (!plainText.trim() && (!commentImages.value[postId] || commentImages.value[postId].length === 0)) {
    ElMessage.warning('请写下祝词或奉纳绘马')
    return
  }
  if (!isAdmin.value && plainText.length > maxLength.value) {
    ElMessage.warning(`祝词不能超过${maxLength.value}字`)
    return
  }
  const formData = new FormData()
  formData.append('postId', postId)
  formData.append('content', contentHtml)
  if (commentImages.value[postId] && commentImages.value[postId].length) formData.append('image', commentImages.value[postId][0].file)
  try {
    const token = localStorage.getItem('oi_token')
    const res = await axios.post('/api/chatRoom/comment', formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('祝词已奉纳')
    if (commentEditors.value[postId]) commentEditors.value[postId].innerHTML = ''
    commentContents.value[postId] = ''
    if (commentImages.value[postId]) {
      commentImages.value[postId].forEach(img => URL.revokeObjectURL(img.url))
      commentImages.value[postId] = []
    }
    const post = posts.value.find(p => p.id === postId)
    if (post && res.data.comment) post.comments.push(res.data.comment)
  } catch (err) { ElMessage.error(err.response?.data?.error || '奉纳失败') }
}
const deleteComment = async (commentId, postId) => {
  try {
    await ElMessageBox.confirm('确定删除该祝词吗？', '提示', { type: 'warning' })
    const token = localStorage.getItem('oi_token')
    await axios.delete(`/api/chatRoom/comment/${commentId}`, { headers: { Authorization: `Bearer ${token}` } })
    ElMessage.success('祝词已删除')
    const post = posts.value.find(p => p.id === postId)
    if (post) post.comments = post.comments.filter(c => c.id !== commentId)
  } catch (err) { if (err !== 'cancel') ElMessage.error('删除失败') }
}
const toggleCommentLike = async (comment, post) => {
  if (!isAuthenticated.value) { ElMessage.warning('请先参拜'); return }
  try {
    const token = localStorage.getItem('oi_token')
    const res = await axios.post(`/api/chatRoom/comment/${comment.id}/like`, {}, { headers: { Authorization: `Bearer ${token}` } })
    if (res.data.success) {
      comment.comment_liked = res.data.liked
      if (res.data.liked) { comment.comment_like_count = (comment.comment_like_count || 0) + 1; ElMessage.success('结缘成功') }
      else { comment.comment_like_count = (comment.comment_like_count || 0) - 1; ElMessage.success('已取消结缘') }
    }
  } catch (err) { ElMessage.error(err.response?.data?.error || '操作失败') }
}
const canDeleteComment = (comment) => {
  if (!isAuthenticated.value) return false
  if (!user.value) return false
  const currentId = user.value.id
  const commentUserId = comment.user_id
  const userPerm = Number(user.value.permission)
  if (userPerm === 0 || userPerm === 1 || userPerm === 2) return true
  return currentId && commentUserId && String(currentId) === String(commentUserId)
}
const toggleComments = (postId) => { expandedComments.value = expandedComments.value === postId ? null : postId }

const imageViewerVisible = ref(false)
const previewImageList = ref([])
const previewImageIndex = ref(0)

const previewImage = (url, imageList = [url], index = 0) => {
  previewImageList.value = imageList
  previewImageIndex.value = index
  imageViewerVisible.value = true
}

const expandedComments = ref(null)

const emojiPanelVisible = ref(false)
const activeEmojiTab = ref('default')
const emojiButtonRef = ref(null)
const emojiPanelStyle = ref({})

const defaultEmojis = ref([])
const customEmojis1 = ref([])
const customEmojis2 = ref([])
for (let i = 1; i <= 74; i++) defaultEmojis.value.push({ img: `/images/emoji/super/${i}.gif` })
for (let i = 1; i <= 127; i++) customEmojis1.value.push({ text: '', img: `/images/emoji/${i}.png` })
for (let i = 1; i <= 118; i++) customEmojis2.value.push({ text: '', img: `/images/emoji/${i}.gif` })

const recentEmojis = ref([])
const MAX_RECENT = 10
const getRecentStorageKey = () => `chatRoom_recent_emojis_${user.value?.id || 'guest'}`
const loadRecentEmojis = () => {
  const stored = localStorage.getItem(getRecentStorageKey())
  if (stored) recentEmojis.value = JSON.parse(stored) || []
}
const saveRecentEmojis = () => localStorage.setItem(getRecentStorageKey(), JSON.stringify(recentEmojis.value))
const addToRecent = (item) => {
  const idx = recentEmojis.value.findIndex(i => i.type === item.type && i.value === item.value)
  if (idx !== -1) recentEmojis.value.splice(idx, 1)
  recentEmojis.value.unshift(item)
  if (recentEmojis.value.length > MAX_RECENT) recentEmojis.value.pop()
  saveRecentEmojis()
}
watch(() => user.value?.id, loadRecentEmojis, { immediate: true })
const favoriteEmojis = ref([])
const loadFavoriteEmojis = async () => {
  if (!isAuthenticated.value) return
  try {
    const res = await axios.get('/api/chatRoom/favorite-emojis', { headers: { Authorization: `Bearer ${localStorage.getItem('oi_token')}` } })
    if (res.data.success) favoriteEmojis.value = res.data.data
  } catch (err) { console.error('加载收藏失败', err) }
}
const addFavoriteEmoji = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { ElMessage.warning('绘马不能超过3MB'); return }
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await axios.post('/api/chatRoom/favorite-emojis', formData, { headers: { Authorization: `Bearer ${localStorage.getItem('oi_token')}` } })
      if (res.data.success) { favoriteEmojis.value.push(res.data.url); ElMessage.success('收藏成功') }
      else ElMessage.error(res.data.error)
    } catch (err) { ElMessage.error('添加失败') }
  }
  input.click()
}
const deleteFavoriteEmoji = async (url, event) => {
  event.preventDefault()
  try {
    await ElMessageBox.confirm('确定删除该收藏表情吗？', '提示', { type: 'warning' })
    const res = await axios.delete('/api/chatRoom/favorite-emojis', { data: { imageUrl: url }, headers: { Authorization: `Bearer ${localStorage.getItem('oi_token')}` } })
    if (res.data.success) { favoriteEmojis.value = favoriteEmojis.value.filter(u => u !== url); ElMessage.success('删除成功') }
    else ElMessage.error(res.data.error)
  } catch (err) { if (err !== 'cancel') ElMessage.error('删除失败') }
}
let favoriteLongPressTimer = null
const onTouchStartFavorite = (event, url) => { favoriteLongPressTimer = setTimeout(() => deleteFavoriteEmoji(url, event), 500) }
const onTouchEndFavorite = () => { if (favoriteLongPressTimer) clearTimeout(favoriteLongPressTimer) }
const updateEmojiPanelPosition = () => {
  if (!emojiButtonRef.value) return
  const rect = emojiButtonRef.value.$el.getBoundingClientRect()
  emojiPanelStyle.value = { position: 'fixed', top: `${rect.bottom + 5}px`, left: `${rect.left}px`, zIndex: 1000 }
}
const toggleEmojiPanel = async (event) => {
  if (event) { event.preventDefault(); event.stopPropagation() }
  if (emojiPanelVisible.value) emojiPanelVisible.value = false
  else { editorRef.value?.focus(); await nextTick(); updateEmojiPanelPosition(); emojiPanelVisible.value = true }
}
let scrollHandler = null, resizeHandler = null
const updateAllPanelPositions = () => {
  if (emojiPanelVisible.value) updateEmojiPanelPosition()
  if (commentEmojiPanelVisible.value) updateCommentEmojiPanelPosition(commentEmojiPanelVisible.value)
}
const handleDocumentClick = (event) => {
  if (emojiPanelVisible.value) {
    const btn = emojiButtonRef.value?.$el, panel = document.querySelector('.emoji-panel-wrapper:not(.comment-emoji-panel)')
    if (btn && !btn.contains(event.target) && panel && !panel.contains(event.target)) emojiPanelVisible.value = false
  }
  if (commentEmojiPanelVisible.value) {
    const panel = document.querySelector('.comment-emoji-panel')
    if (panel && !panel.contains(event.target) && !event.target.closest('.comment-actions')) commentEmojiPanelVisible.value = null
  }
}

const disableContextMenu = (e) => { e.preventDefault(); return false }
const disableDragStart = (e) => { if (e.target.tagName === 'IMG') { e.preventDefault(); return false } }
const disableDevTools = (e) => {
  const key = e.key
  if (key === 'F12' || (e.ctrlKey && e.shiftKey && (key === 'I' || key === 'C')) || (e.ctrlKey && key === 'U') || (e.ctrlKey && key === 'S')) {
    e.preventDefault(); return false
  }
}
let devtoolsDetector = null

onMounted(() => {
  if (!isAuthenticated.value) { 
    ElMessage.warning('游客无法参拜，请先结缘')
  }
  fetchPosts(); 
  loadRecentEmojis(); 
  loadFavoriteEmojis()
  document.addEventListener('click', handleDocumentClick)
  scrollHandler = () => updateAllPanelPositions()
  resizeHandler = () => updateAllPanelPositions()
  window.addEventListener('scroll', scrollHandler, true)
  window.addEventListener('resize', resizeHandler)
  document.addEventListener('contextmenu', disableContextMenu)
  document.addEventListener('dragstart', disableDragStart)
  document.addEventListener('keydown', disableDevTools)
  devtoolsDetector = setInterval(() => {
    const start = performance.now()
    debugger
    const end = performance.now()
    if (end - start > 100) { alert('请关闭开发者工具后刷新页面'); window.location.href = '/' }
  }, 2000)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler, true)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  document.removeEventListener('contextmenu', disableContextMenu)
  document.removeEventListener('dragstart', disableDragStart)
  document.removeEventListener('keydown', disableDevTools)
  if (devtoolsDetector) clearInterval(devtoolsDetector)
})
const username = computed(() => user.value?.name || '')
const userAvatar = computed(() => user.value?.avatar || '')
</script>

<style scoped>
.kamihome-gaga-page {
  min-height: 100vh;
  background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
  font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
  padding: 24px;
  box-sizing: border-box;
  overflow: visible;
}
.container { max-width: 800px; margin: 0 auto; overflow: visible; position: relative; }

.kamihome-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(5px);
  border: 2px solid #c33a2b;
  border-radius: 16px 16px 16px 6px;
  box-shadow: 0 5px 0 #9b2a1a, 0 8px 16px rgba(160, 60, 40, 0.1);
  transition: all 0.15s ease;
  position: relative;
  overflow: visible;
  padding: 20px;
  margin-bottom: 20px;
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
  gap: 6px;
}
.kamihome-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #9b2a1a; background: #fce4d6; }
.kamihome-btn.small { padding: 4px 12px; font-size: 13px; }
.icon-button { padding: 5px 10px; }

.post-form { margin-bottom: 24px; }
.shrine-header {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px dashed #c33a2b;
}
.shrine-header .header-icon { font-size: 24px; }
.shrine-header .header-text { font-size: 20px; font-weight: 700; color: #5e2c1a; text-shadow: 2px 2px 0 #f0d8c0; }

.rich-editor {
  background: #fef7f0; border: 1.5px solid #c33a2b; border-radius: 12px;
  padding: 12px 16px; min-height: 80px; max-height: 200px; overflow-y: auto;
  outline: none; color: #3a2214; box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);
}
.rich-editor:focus { border-color: #a03820; }
.rich-editor[placeholder]:empty:before { content: attr(placeholder); color: #9b8a7a; }

.image-upload { margin-top: 16px; }
.image-list { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.image-item { position: relative; width: 80px; height: 80px; border-radius: 8px; border: 1.5px solid #c33a2b; overflow: hidden; }
.image-item img { width: 100%; height: 100%; object-fit: cover; }
.image-item .remove { position: absolute; top: -6px; right: -6px; background: #c33a2b; color: #fff5e0; border-radius: 50%; cursor: pointer; font-size: 16px; padding: 2px; }
.image-item.small { width: 60px; height: 60px; }

.action-buttons { display: flex; gap: 8px; }
.form-actions { margin-top: 16px; text-align: right; }

.posts-list { display: flex; flex-direction: column; gap: 20px; overflow: visible; }
.post-card { padding: 20px; overflow: visible; }
.post-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.user-info { flex: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.user-info .name { font-weight: 700; color: #5e2c1a; }
.user-info .time { font-size: 12px; color: #7a3a28; }
.more-icon { font-size: 20px; cursor: pointer; color: #7a3a28; }
.more-icon-small { font-size: 16px; cursor: pointer; color: #7a3a28; }

.post-content { margin-bottom: 16px; line-height: 1.6; color: #3a2214; word-break: break-word; }
.post-content :deep(img.inline-emoji) { width: 25px; height: 25px; vertical-align: middle; margin: 0 2px; }

.post-images { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.post-image { width: 120px; height: 120px; border-radius: 8px; border: 1.5px solid #c33a2b; overflow: hidden; cursor: pointer; }
.post-image img { width: 100%; height: 100%; object-fit: cover; }

.post-stats { display: flex; gap: 24px; padding-top: 12px; border-top: 2px dashed #c33a2b; }
.action-item { display: flex; align-items: center; gap: 6px; cursor: pointer; color: #5e2c1a; font-weight: 500; transition: color 0.2s; }
.action-item:hover { color: #c33a2b; }
.action-icon { width: 24px; height: 24px; filter: brightness(0) saturate(100%) invert(20%) sepia(30%) saturate(1200%) hue-rotate(338deg); }
.action-icon-small { width: 16px; height: 16px; }

.comments-area { margin-top: 16px; padding: 16px; background: rgba(245, 230, 211, 0.3); border-radius: 12px; border: 1px dashed #c33a2b; overflow: visible; }
.comment-list { display: flex; flex-direction: column; gap: 14px; }
.comment-item { display: flex; gap: 10px; overflow: visible; }
.comment-content-wrapper { flex: 1; background: white; padding: 10px 14px; border-radius: 16px; border: 1px solid #c33a2b; overflow: visible; }
.comment-user-info { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.comment-user { font-weight: 600; color: #5e2c1a; }
.comment-content { word-break: break-word; color: #3a2214; }
.comment-image { margin-top: 8px; cursor: pointer; }
.comment-image img { max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid #c33a2b; }
.comment-meta { margin-top: 8px; display: flex; gap: 16px; font-size: 11px; color: #7a3a28; }
.comment-like { display: flex; align-items: center; gap: 4px; cursor: pointer; }

.comment-input-wrapper { margin-top: 16px; background: white; border-radius: 12px; padding: 12px; border: 1px solid #c33a2b; }
.comment-editor { min-height: 60px; max-height: 120px; margin-bottom: 10px; }
.comment-actions { display: flex; gap: 8px; justify-content: flex-end; overflow: visible; }

.emoji-panel-wrapper { background: #fef7f0; border: 2px solid #c33a2b; border-radius: 16px; box-shadow: 0 5px 0 #9b2a1a; width: 350px; position: fixed; z-index: 1000; }
.emoji-panel { max-height: 320px; overflow-y: auto; padding: 8px; }
.emoji-panel::-webkit-scrollbar { width: 4px; }
.emoji-panel::-webkit-scrollbar-thumb { background: #c33a2b; border-radius: 2px; }
.emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; padding: 8px; }
.emoji-item-custom { display: flex; justify-content: center; align-items: center; cursor: pointer; padding: 4px; border-radius: 8px; transition: transform 0.2s; }
.emoji-item-custom:hover { transform: scale(1.3); background: #fce4d6; }
.recent-emojis { padding: 8px; border-bottom: 1px dashed #c33a2b; }
.recent-title { font-size: 12px; color: #7a3a28; margin-bottom: 8px; }
.recent-grid { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; }
.recent-emoji-item { flex-shrink: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; border-radius: 8px; background: rgba(245, 230, 211, 0.5); border: 1px solid #c33a2b; }
.recent-emoji-item:hover { background: #fce4d6; }
.favorite-header { display: flex; justify-content: space-between; align-items: center; padding: 8px; }
.favorite-tip { font-size: 11px; color: #7a3a28; }
.favorite-grid .emoji-item-custom { width: 70px; height: 70px; }
.empty-favorite { text-align: center; padding: 20px; color: #7a3a28; }

:deep(.kamihome-dialog) { background: #fef7f0 !important; border: 3px solid #c33a2b !important; border-radius: 20px !important; box-shadow: 0 6px 0 #9b2a1a !important; }
:deep(.kamihome-dialog .el-dialog__header) { border-bottom: 2px dashed #c33a2b; }
:deep(.kamihome-dialog .el-dialog__title) { color: #5e2c1a; font-weight: 600; }

@media (max-width: 768px) {
  .kamihome-gaga-page { padding: 16px; }
  .container { max-width: 100%; }
  .post-image { width: 80px; height: 80px; }
  .emoji-panel-wrapper { width: 90%; max-width: 350px; left: 50% !important; transform: translateX(-50%); top: auto !important; bottom: 60px !important; }
  .emoji-grid { grid-template-columns: repeat(5, 1fr); }
}
</style>
