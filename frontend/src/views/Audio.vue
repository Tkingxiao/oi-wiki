<script setup>
import { ref, reactive, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { ElMessageBox, ElMessage, ElLoading } from 'element-plus'
import { UploadFilled, Warning, VideoPlay, Download, TrendCharts } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { getAudioList, uploadAudio, matchAudiosByAI, downloadAudios, recordAudioPlay, getWeeklyPopularAudios, getTotalPopularAudios } from '@/api/audio'

const audioSections = ref([])
const loading = ref(false)
const error = ref(null)

async function fetchAudioList() {
    try {
        loading.value = true
        error.value = null
        const response = await getAudioList()
        audioSections.value = response.data
    } catch (err) {
        console.error('获取音声列表失败:', err)
        error.value = '获取音声列表失败，请稍后重试'
        ElMessage.error('获取音声列表失败，请稍后重试')
        audioSections.value = []
    } finally {
        loading.value = false
    }
}

const audio = ref(null)
const currentSectionIndex = ref(-1)
const currentTrackIndex = ref(-1)
const isPlaying = ref(false)
const volume = ref(0.9)
const audioUnlocked = ref(false)
const backgroundAudios = ref([])

const hellScrollAudios = ref([])
const isHellScrollMode = ref(false)

const userStore = useUserStore()
const { isAuthenticated } = storeToRefs(userStore)

const loopPlaylist = ref(false)
const shuffle = ref(false)
const brainwash = ref(false)
const autoStopOnSwitch = ref(true)

const uploadDialogVisible = ref(false)
const uploadRef = ref(null)
const uploadForm = reactive({
    audioFile: null,
    audioName: '',
    audioTag: '',
    newTagName: ''
})

const aiMatchDialogVisible = ref(false)
const aiMatchLoading = ref(false)
const aiMatchForm = reactive({ description: '' })
const aiMatchResults = ref([])
const aiMatchMessage = ref('')
const aiMatchReason = ref('')
const aiMatchReasonDisplay = ref('')
const isTypingReason = ref(false)
const aiAutoPlayIndex = ref(-1)
const isAiAutoPlaying = ref(false)

const hotAudioSortType = ref('week')
const hotAudioLimit = ref(10)
const hotAudioList = ref([])
const hotAudioLoading = ref(false)

async function fetchHotAudios() {
    try {
        hotAudioLoading.value = true
        let response
        if (hotAudioSortType.value === 'week') {
            response = await getWeeklyPopularAudios(hotAudioLimit.value)
        } else {
            response = await getTotalPopularAudios(hotAudioLimit.value)
        }
        
        if (response.data && response.data.audios) {
            hotAudioList.value = response.data.audios.map((item) => ({
                id: item.id,
                name: item.name,
                url: item.url,
                tagName: item.classification?.name || '未知分类',
                classificationId: item.classification?.id,
                playCount: hotAudioSortType.value === 'week' ? (item.weeklyPlays || 0) : (item.totalPlayCount || 0)
            }))
        } else {
            hotAudioList.value = []
        }
    } catch (err) {
        console.error('获取热门音频失败:', err)
        hotAudioList.value = []
    } finally {
        hotAudioLoading.value = false
    }
}

watch([hotAudioSortType, hotAudioLimit], () => {
    fetchHotAudios()
}, { immediate: true })

function formatCount(count) {
    if (count >= 10000) return (count / 10000).toFixed(1) + '万'
    return count.toString()
}

async function playHotAudio(item) {
    const sectionIndex = audioSections.value.findIndex(s => s.id === item.classificationId)
    if (sectionIndex === -1) {
        playByUrl(item.url, item.name)
        try { await recordAudioPlay(item.id) } catch (e) {}
        return
    }
    
    const trackIndex = audioSections.value[sectionIndex].items.findIndex(
        t => (t.id || t.audioId) === item.id
    )
    if (trackIndex === -1) {
        playByUrl(item.url, item.name)
        try { await recordAudioPlay(item.id) } catch (e) {}
        return
    }
    
    currentSectionIndex.value = sectionIndex
    currentTrackIndex.value = trackIndex
    playCurrent()
}

function playByUrl(url, name) {
    createAudioIfNeeded()
    
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || ''
    const fullUrl = url.startsWith('http') ? url : baseUrl + url
    
    if (autoStopOnSwitch.value) {
        audio.value.pause()
        audio.value.currentTime = 0
        isPlaying.value = false
        
        audio.value.src = fullUrl
        audio.value.loop = !!brainwash.value
        audio.value.volume = volume.value
        
        if (!audioUnlocked.value) unlockAudio()
        
        currentSectionIndex.value = -1
        currentTrackIndex.value = -1
        
        audio.value.play().then(() => {
            isPlaying.value = true
        }).catch((error) => {
            console.error('播放失败:', error)
            ElMessage.error('播放失败，请联系管理员')
            isPlaying.value = false
        })
    } else {
        const newAudio = new Audio(fullUrl)
        newAudio.volume = volume.value
        newAudio.loop = !!brainwash.value
        backgroundAudios.value.push(newAudio)
        
        if (!audioUnlocked.value) unlockAudio()
        
        newAudio.play().catch((error) => {
            console.error('后台播放失败:', error)
        })
    }
}

const tagOptions = computed(() => {
    const tags = []
    audioSections.value.forEach(section => {
        tags.push({ label: section.title, value: section.id })
    })
    return tags
})

const uploadFormRules = {
    audioFile: [{ required: true, message: '请选择音频文件', trigger: 'change' }],
    audioName: [
        { required: true, message: '请输入音声名称', trigger: 'blur' },
        { min: 1, max: 50, message: '音声名称长度应在1-50个字符', trigger: 'blur' }
    ],
    audioTag: [{ required: true, message: '请选择或输入音声标签', trigger: 'change' }]
}

const aiMatchFormRules = {
    description: [
        { required: true, message: '请输入音频描述', trigger: 'blur' },
        { min: 1, max: 500, message: '描述长度应在1-500个字符', trigger: 'blur' }
    ]
}

const flattened = computed(() => {
    const arr = []
    audioSections.value.forEach((sec, sidx) => {
        sec.items.forEach((it, tidx) => {
            arr.push({
                sidx,
                tidx,
                id: it.id || it.audioId || tidx.toString(),
                name: it.name,
                url: it.url
            })
        })
    })
    return arr
})

function createAudioIfNeeded() {
    if (!audio.value) {
        audio.value = new Audio()
        audio.value.preload = 'auto'
        audio.value.volume = volume.value
        audio.value.addEventListener('ended', onTrackEnded)
    }
}

function unlockAudio() {
    if (audioUnlocked.value) return
    const unlockAudio = new Audio()
    unlockAudio.volume = 0.01
    unlockAudio.play().then(() => {
        audioUnlocked.value = true
    }).catch(() => {})
}

function playByFlatIndex(flatIndex) {
    if (flatIndex < 0 || flatIndex >= flattened.value.length) return
    if (isHellScrollMode.value) stopHellScroll()
    const entry = flattened.value[flatIndex]
    currentSectionIndex.value = entry.sidx
    currentTrackIndex.value = entry.tidx
    playCurrent()
}

async function playCurrent() {
    const secIdx = currentSectionIndex.value
    const trIdx = currentTrackIndex.value
    if (secIdx < 0 || trIdx < 0 || secIdx >= audioSections.value.length ||
        trIdx >= audioSections.value[secIdx].items.length) return
    const track = audioSections.value[secIdx].items[trIdx]
    createAudioIfNeeded()

    const baseUrl = import.meta.env.VITE_APP_BASE_URL || ''
    const fullUrl = track.url.startsWith('http') ? track.url : baseUrl + track.url

    const audioId = track.id || track.audioId
    if (audioId) {
        try { await recordAudioPlay(audioId) } catch (e) {}
    }

    if (autoStopOnSwitch.value) {
        audio.value.pause()
        audio.value.currentTime = 0
        isPlaying.value = false

        audio.value.src = fullUrl
        audio.value.loop = !!brainwash.value
        audio.value.volume = volume.value
        if (!audioUnlocked.value) unlockAudio()
        audio.value.play().then(() => {
            isPlaying.value = true
        }).catch((error) => {
            console.error('播放失败:', error)
            ElMessage.error('播放失败，请联系管理员')
            if (!audioUnlocked.value) unlockAudio()
            isPlaying.value = false
        })
    } else {
        const backgroundAudio = new Audio(fullUrl)
        backgroundAudio.volume = volume.value
        backgroundAudio.loop = !!brainwash.value
        backgroundAudio.preload = 'auto'

        backgroundAudio.addEventListener('ended', () => {
            const index = backgroundAudios.value.indexOf(backgroundAudio)
            if (index > -1) backgroundAudios.value.splice(index, 1)
        })

        backgroundAudio.play().catch((error) => {
            console.error('后台音频播放失败:', error)
        })

        backgroundAudios.value.push(backgroundAudio)
    }
}

function playTrack(sectionIdx, trackIdx) {
    if (isHellScrollMode.value) stopHellScroll()
    if (sectionIdx < 0 || sectionIdx >= audioSections.value.length ||
        trackIdx < 0 || trackIdx >= audioSections.value[sectionIdx].items.length) return
    currentSectionIndex.value = sectionIdx
    currentTrackIndex.value = trackIdx
    playCurrent()
}

function stopPlayback(resetModes = true, keepAiAutoPlay = false) {
    if (isHellScrollMode.value) stopHellScroll()
    if (isAiAutoPlaying.value && !keepAiAutoPlay) stopAiAutoPlay()

    if (audio.value) {
        audio.value.pause()
        audio.value.currentTime = 0
        audio.value.loop = false
    }
    isPlaying.value = false

    backgroundAudios.value.forEach(bgAudio => {
        bgAudio.pause()
        bgAudio.currentTime = 0
    })
    backgroundAudios.value = []

    if (resetModes) {
        loopPlaylist.value = false
        shuffle.value = false
        brainwash.value = false
    }
}

function toggleLoopPlaylist() {
    if (isHellScrollMode.value) return
    if (!audioUnlocked.value) unlockAudio()
    loopPlaylist.value = true
    shuffle.value = false
    brainwash.value = false
    if (audio.value) audio.value.loop = false
    if (currentSectionIndex.value >= 0 && currentTrackIndex.value >= 0 && isPlaying.value) {
        playCurrent()
    } else {
        playByFlatIndex(0)
    }
}

function toggleShuffle() {
    if (isHellScrollMode.value) return
    if (!audioUnlocked.value) unlockAudio()
    shuffle.value = true
    loopPlaylist.value = false
    brainwash.value = false
    if (audio.value) audio.value.loop = false
    if (currentSectionIndex.value >= 0 && currentTrackIndex.value >= 0 && isPlaying.value) {
        playCurrent()
    } else {
        playByFlatIndex(0)
    }
}

function toggleBrainwash() {
    if (isHellScrollMode.value) return
    if (loopPlaylist.value || shuffle.value) return
    brainwash.value = !brainwash.value
    if (audio.value) audio.value.loop = !!brainwash.value
    backgroundAudios.value.forEach(bgAudio => bgAudio.loop = !!brainwash.value)
}

function toggleAutoStopOnSwitch() {
    if (isHellScrollMode.value) return
    autoStopOnSwitch.value = !autoStopOnSwitch.value
}

async function startHellScroll() {
    try {
        await ElMessageBox.confirm(
            '⚠️ 警告：地狱绘卷模式将同时播放所有音频并开启洗脑循环！\n\n这可能会导致严重的性能问题和听力损伤。\n\n确定要继续吗？',
            '地狱绘卷警告',
            { confirmButtonText: '确定开启', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
        )

        stopPlayback(true)
        if (!audioUnlocked.value) unlockAudio()

        hellScrollAudios.value.forEach(audio => {
            audio.pause()
            audio.removeEventListener('ended', onTrackEnded)
        })
        hellScrollAudios.value = []

        const baseUrl = import.meta.env.VITE_APP_BASE_URL || ''
        flattened.value.forEach(track => {
            const fullUrl = track.url.startsWith('http') ? track.url : baseUrl + track.url
            const audioInstance = new Audio(fullUrl)
            audioInstance.volume = volume.value * 0.3
            audioInstance.loop = true
            audioInstance.preload = 'auto'

            audioInstance.addEventListener('error', (e) => {
                console.warn(`Failed to load audio: ${track.name}`, e)
            })

            audioInstance.play().catch((error) => {
                console.warn(`Failed to play audio ${track.name}:`, error)
            })

            hellScrollAudios.value.push(audioInstance)
        })

        isHellScrollMode.value = true
    } catch (error) {
        console.log('用户取消了地狱绘卷模式')
    }
}

function stopHellScroll() {
    hellScrollAudios.value.forEach(audio => {
        audio.pause()
        audio.currentTime = 0
        audio.removeEventListener('ended', onTrackEnded)
        audio.removeEventListener('error', () => {})
        audio.src = ''
    })
    hellScrollAudios.value = []
    isHellScrollMode.value = false
}

function onTrackEnded() {
    if (brainwash.value && audio.value.loop) return

    if (isAiAutoPlaying.value) {
        aiAutoPlayIndex.value++
        playAiAutoPlayCurrent()
        return
    }

    if (shuffle.value) {
        const flatIndex = flattened.value.findIndex(e => e.sidx === currentSectionIndex.value && e.tidx === currentTrackIndex.value)
        if (flattened.value.length <= 1) return
        let next = flatIndex
        while (next === flatIndex) {
            next = Math.floor(Math.random() * flattened.value.length)
        }
        playByFlatIndex(next)
        return
    }

    if (loopPlaylist.value) {
        const flatIndex = flattened.value.findIndex(e => e.sidx === currentSectionIndex.value && e.tidx === currentTrackIndex.value)
        let nextIndex = flatIndex + 1
        if (nextIndex >= flattened.value.length) nextIndex = 0
        playByFlatIndex(nextIndex)
        return
    }

    stopPlayback(false)
}

const currentTrackName = computed(() => {
    if (isHellScrollMode.value) return '🔥 地狱绘卷模式'
    if (isAiAutoPlaying.value) {
        const audioId = aiMatchResults.value[aiAutoPlayIndex.value]
        return `AI播放中: ${getAudioNameById(audioId)} (${aiAutoPlayIndex.value + 1}/${aiMatchResults.value.length})`
    }
    if (currentSectionIndex.value < 0 || currentTrackIndex.value < 0 ||
        currentSectionIndex.value >= audioSections.value.length ||
        currentTrackIndex.value >= audioSections.value[currentSectionIndex.value].items.length) return '— 未选择 —'
    const t = audioSections.value[currentSectionIndex.value].items[currentTrackIndex.value]
    return t ? t.name : '— 未选择 —'
})

function openUploadDialog() {
    if (audioSections.value.length === 0 && !loading.value) fetchAudioList()
    uploadDialogVisible.value = true
    uploadForm.audioFile = null
    uploadForm.audioName = ''
    uploadForm.audioTag = ''
    uploadForm.newTagName = ''
}

function closeUploadDialog() {
    uploadDialogVisible.value = false
}

function handleFileExceed(files, fileList) {
    ElMessage.warning('只能选择一个音频文件，请先移除当前文件后再选择新的文件')
}

function handleFileChange(file, fileList) {
    if (fileList.length > 0) {
        const selectedFile = file.raw || file
        uploadForm.audioFile = selectedFile
        if (!uploadForm.audioName) {
            uploadForm.audioName = selectedFile.name.replace(/\.[^/.]+$/, '')
        }
    } else {
        uploadForm.audioFile = null
        uploadForm.audioName = ''
    }
}

function handleTagSelect(value) {
    if (!value) {
        uploadForm.newTagName = ''
        return
    }
    const existingTag = tagOptions.value.find(tag => tag.value === value)
    if (!existingTag) {
        const newTagId = `new_${Date.now()}`
        audioSections.value.push({ id: newTagId, title: value, items: [] })
        uploadForm.audioTag = newTagId
        uploadForm.newTagName = value
        ElMessage.success(`新标签 "${value}" 已创建`)
    } else {
        uploadForm.newTagName = ''
    }
}

async function uploadAudioFile(formData, file) {
    try {
        const uploadData = new FormData()
        uploadData.append('audio', file)
        uploadData.append('name', formData.audioName)

        const isNewTag = formData.audioTag && typeof formData.audioTag === 'string' && formData.audioTag.startsWith('new_')
        if (isNewTag) {
            uploadData.append('new_classification_name', formData.newTagName || formData.audioTag.replace('new_', ''))
        } else if (formData.audioTag) {
            uploadData.append('classification_id', formData.audioTag)
        } else {
            throw new Error('请选择音声分类')
        }

        const response = await uploadAudio(uploadData)
        return { success: true, message: response.message, data: response.data }
    } catch (error) {
        console.error('上传失败:', error)
        let errorMessage = `文件 "${file.name}" 上传失败`
        if (error.response) {
            const { status, data } = error.response
            switch (status) {
                case 400: errorMessage = data.message || '请求参数错误'; break
                case 401: errorMessage = '未认证，请先登录'; break
                case 403: errorMessage = 'Token无效或权限不足'; break
                case 413: errorMessage = '文件过大，超过5MB限制'; break
                case 500: errorMessage = '服务器内部错误'; break
                default: errorMessage = `上传失败: ${status}`
            }
        } else if (error.request) {
            errorMessage = '网络错误，请检查网络连接'
        }
        throw new Error(errorMessage)
    }
}

async function handleUpload() {
    try {
        if (!uploadForm.audioFile) return ElMessage.error('请选择音频文件')
        if (!uploadForm.audioName.trim()) return ElMessage.error('请输入音声名称')
        if (!uploadForm.audioTag) return ElMessage.error('请选择音声标签')

        const allowedTypes = ['audio/mpeg', 'audio/mp3']
        const maxSize = 5 * 1024 * 1024

        if (!allowedTypes.includes(uploadForm.audioFile.type)) {
            return ElMessage.error(`文件 "${uploadForm.audioFile.name}" 不是 MP3 格式`)
        }
        if (uploadForm.audioFile.size > maxSize) {
            return ElMessage.error(`文件 "${uploadForm.audioFile.name}" 超过 5MB 限制`)
        }

        const loading = ElLoading.service({ lock: true, text: '正在上传中...', background: 'rgba(0, 0, 0, 0.7)' })

        try {
            const result = await uploadAudioFile({
                audioName: uploadForm.audioName.trim(),
                audioTag: uploadForm.audioTag,
                newTagName: uploadForm.newTagName
            }, uploadForm.audioFile)

            loading.close()
            ElMessage.success(result.message)
            closeUploadDialog()
            await fetchAudioList()
            uploadForm.audioFile = null
            uploadForm.audioName = ''
            uploadForm.newTagName = ''
            if (uploadRef.value) uploadRef.value.clearFiles()
        } catch (error) {
            loading.close()
            ElMessage.error(error.message || '上传过程中发生错误')
        }
    } catch (error) {
        console.log(error)
        ElMessage.error('上传过程中发生错误')
    }
}

function startTypingReason() {
    aiMatchReasonDisplay.value = ''
    isTypingReason.value = true
    const fullText = aiMatchReason.value
    let currentIndex = 0
    const typeInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
            aiMatchReasonDisplay.value += fullText[currentIndex]
            currentIndex++
        } else {
            clearInterval(typeInterval)
            isTypingReason.value = false
        }
    }, 50)
}

function startAiAutoPlay() {
    if (aiMatchResults.value.length === 0) return
    isAiAutoPlaying.value = true
    aiAutoPlayIndex.value = 0
    stopPlayback(false, true)
    playAiAutoPlayCurrent()
}

function playAiAutoPlayCurrent() {
    if (!isAiAutoPlaying.value || aiAutoPlayIndex.value >= aiMatchResults.value.length) {
        stopAiAutoPlay()
        return
    }
    const audioId = aiMatchResults.value[aiAutoPlayIndex.value]
    const audioIndex = flattened.value.findIndex(item => item.id == audioId)
    if (audioIndex >= 0) {
        const entry = flattened.value[audioIndex]
        currentSectionIndex.value = entry.sidx
        currentTrackIndex.value = entry.tidx
        createAudioIfNeeded()
        const baseUrl = import.meta.env.VITE_APP_BASE_URL || ''
        const fullUrl = entry.url.startsWith('http') ? entry.url : baseUrl + entry.url
        audio.value.src = fullUrl
        audio.value.loop = false
        audio.value.volume = volume.value
        if (!audioUnlocked.value) unlockAudio()
        audio.value.play().then(() => {
            isPlaying.value = true
        }).catch((error) => {
            console.error('AI自动播放失败:', error)
            aiAutoPlayIndex.value++
            playAiAutoPlayCurrent()
        })
    } else {
        aiAutoPlayIndex.value++
        playAiAutoPlayCurrent()
    }
}

function stopAiAutoPlay() {
    isAiAutoPlaying.value = false
    aiAutoPlayIndex.value = -1
}

function openAIMatchDialog() {
    aiMatchDialogVisible.value = true
    aiMatchForm.description = ''
    aiMatchResults.value = []
    aiMatchMessage.value = ''
}

function closeAIMatchDialog() {
    aiMatchDialogVisible.value = false
    if (isAiAutoPlaying.value) stopAiAutoPlay()
    aiMatchResults.value = []
    aiMatchMessage.value = ''
    aiMatchReason.value = ''
    aiMatchReasonDisplay.value = ''
    isTypingReason.value = false
}

async function handleAIMatch() {
    try {
        if (!aiMatchForm.description.trim()) return ElMessage.error('请输入音频描述')
        if (aiMatchForm.description.length > 500) return ElMessage.error('描述长度不能超过500字符')

        aiMatchLoading.value = true
        aiMatchResults.value = []
        aiMatchMessage.value = ''

        const response = await matchAudiosByAI(aiMatchForm.description.trim())

        if (response.code === 200) {
            aiMatchResults.value = response.data.matched_audios || []
            aiMatchMessage.value = response.data.message || `找到 ${response.data.count || 0} 个匹配的音频`
            aiMatchReason.value = response.data.reason || ''

            if (aiMatchResults.value.length === 0) {
                ElMessage.info('未找到匹配的音频，请尝试其他描述')
            } else {
                ElMessage.success(`成功匹配到 ${aiMatchResults.value.length} 个音频！`)
                if (aiMatchReason.value) startTypingReason()
                startAiAutoPlay()
            }
        } else {
            ElMessage.error(response.message || '匹配失败，请稍后重试')
        }
    } catch (error) {
        console.error('AI匹配失败:', error)
        let errorMessage = '匹配过程中发生错误'
        if (error.response) {
            const { status, data } = error.response
            switch (status) {
                case 400: errorMessage = data.message || '请求参数错误'; break
                case 402: errorMessage = 'AI服务余额不足'; break
                case 429: errorMessage = '请求过于频繁，请稍后再试'; break
                case 500: errorMessage = '服务器内部错误'; break
                case 503: errorMessage = 'AI服务暂时不可用'; break
                default: errorMessage = `匹配失败: ${status}`
            }
        } else if (error.request) {
            errorMessage = '网络错误，请检查网络连接'
        }
        ElMessage.error(errorMessage)
        aiMatchResults.value = []
        aiMatchMessage.value = ''
    } finally {
        aiMatchLoading.value = false
    }
}

function getAudioNameById(audioId) {
    const audio = flattened.value.find(item => item.id == audioId)
    return audio ? audio.name : `音频 ${audioId}`
}

function playMatchedAudio(audioId) {
    const audioIndex = flattened.value.findIndex(item => item.id == audioId)
    if (audioIndex >= 0) {
        playByFlatIndex(audioIndex)
        ElMessage.success(`开始播放: ${getAudioNameById(audioId)}`)
    } else {
        ElMessage.warning(`未找到音频文件: ${audioId}`)
    }
}

watch(volume, (newVolume) => {
    if (audio.value) audio.value.volume = newVolume
    backgroundAudios.value.forEach(bgAudio => bgAudio.volume = newVolume)
    if (isHellScrollMode.value) {
        hellScrollAudios.value.forEach(hellAudio => hellAudio.volume = newVolume * 0.3)
    }
})

function disableContextMenu(e) {
    const target = e.target
    if (target.tagName === 'AUDIO' || target.tagName === 'VIDEO' || target.tagName === 'IMG' || target.closest('audio') || target.closest('video') || target.closest('img')) {
        e.preventDefault()
    }
}
function disableKeyboardShortcuts(e) {
    if (e.key === 'F12') e.preventDefault()
    if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) e.preventDefault()
    if (e.ctrlKey && ['s', 'u', 'p', 'i'].includes(e.key.toLowerCase())) e.preventDefault()
}
function disableDrag(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') e.preventDefault()
}
function startDevToolsDetection() {
    setInterval(() => {
        const threshold = 160
        if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1a1a1a;color:#fff;font-size:24px;">⛩️ 检测到开发者工具，页面已保护</div>'
        }
    }, 1000)
}

onMounted(async () => {
    document.addEventListener('contextmenu', disableContextMenu)
    document.addEventListener('keydown', disableKeyboardShortcuts)
    startDevToolsDetection()
    document.addEventListener('dragstart', disableDrag)
    await fetchAudioList()
})

async function downloadAllAudios() {
    try {
        await ElMessageBox.confirm(
            `确定要下载所有 ${flattened.value.length} 个音声吗？`,
            '下载全部音声确认',
            { confirmButtonText: '确定下载', cancelButtonText: '取消', type: 'warning' }
        )
        downloadAudios(null);
        ElMessage.success(`正在下载全部 ${flattened.value.length} 个音声...`)
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error('下载失败，请稍后重试');
        }
    }
}

async function downloadAudiosByTag(section) {
    try {
        await ElMessageBox.confirm(
            `确定要下载标签 "${section.title}" 的所有 ${section.items.length} 个音声吗？`,
            '下载标签音声确认',
            { confirmButtonText: '确定下载', cancelButtonText: '取消', type: 'info' }
        )
        downloadAudios(section.id);
        ElMessage.success(`正在下载标签 "${section.title}" 的所有音声...`)
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error('下载失败，请稍后重试');
        }
    }
}

onBeforeUnmount(() => {
    document.removeEventListener('contextmenu', disableContextMenu)
    document.removeEventListener('keydown', disableKeyboardShortcuts)
    document.removeEventListener('dragstart', disableDrag)
    if (audio.value) {
        audio.value.pause()
        audio.value.removeEventListener('ended', onTrackEnded)
        audio.value = null
    }
    backgroundAudios.value.forEach(bgAudio => {
        bgAudio.pause()
        bgAudio.removeEventListener('ended', () => {})
    })
    backgroundAudios.value = []
    stopHellScroll()
})
</script>

<template>
    <div class="kamihome-audio-page" @click="unlockAudio">
        <div class="container">
            <section class="shrine-hero">
                <div class="hero-content">
                    <h1 class="hero-title">
                        <span class="hero-icon">🦊</span> 祝词音声 <span class="hero-icon">🎵</span>
                    </h1>
                    <p class="hero-subtitle">聆听神使的祝词，结下美妙的缘</p>
                </div>
            </section>

            <div class="controls-card kamihome-card">
                <div class="controls-main">
                    <div class="control-group">
                        <el-button @click="stopPlayback" class="kamihome-btn" plain>停止祝词</el-button>
                        <el-button :type="loopPlaylist ? 'danger' : ''" @click="toggleLoopPlaylist" :disabled="isHellScrollMode" class="kamihome-btn" plain>缘结循环</el-button>
                        <el-button :type="shuffle ? 'danger' : ''" @click="toggleShuffle" :disabled="isHellScrollMode" class="kamihome-btn" plain>随机缘结</el-button>
                        <el-button :type="brainwash ? 'danger' : ''" @click="toggleBrainwash" :disabled="isHellScrollMode" class="kamihome-btn" plain>神乐洗脑: {{ brainwash ? '开' : '关' }}</el-button>
                        <el-button :type="autoStopOnSwitch ? 'success' : ''" @click="toggleAutoStopOnSwitch" :disabled="isHellScrollMode" class="kamihome-btn" plain>切换时静心: {{ autoStopOnSwitch ? '开' : '关' }}</el-button>
                        <el-button type="danger" @click="startHellScroll" :disabled="isHellScrollMode" class="kamihome-btn" plain>🔥 地狱绘卷</el-button>
                        <el-button @click="openAIMatchDialog" class="kamihome-btn" plain>✨ 神谕匹配</el-button>
                        <el-button v-if="isAuthenticated" @click="downloadAllAudios" class="kamihome-btn" plain>
                            <el-icon><Download /></el-icon> 下载祝词
                        </el-button>
                        <el-button v-if="isAuthenticated" @click="openUploadDialog" class="kamihome-btn" plain>
                            <el-icon><UploadFilled /></el-icon> 奉纳祝词
                        </el-button>
                    </div>
                </div>
                <div class="controls-status">
                    <div class="now-playing">
                        当前祝词: <strong>{{ currentTrackName }}</strong>
                    </div>
                </div>
            </div>

            <div class="controls-card kamihome-card hot-audio-card">
                <div class="hot-audio-header">
                    <h3 class="hot-audio-title">
                        <el-icon><TrendCharts /></el-icon>
                        人气祝词
                    </h3>
                    <div class="hot-audio-controls">
                        <!-- 主题化单选按钮组 -->
                        <el-radio-group v-model="hotAudioSortType" size="small" class="theme-radio-group">
                            <el-radio-button label="week">本周缘结</el-radio-button>
                            <el-radio-button label="total">总缘结数</el-radio-button>
                        </el-radio-group>
                        <!-- 主题化下拉选择器 -->
                        <el-select 
                            v-model="hotAudioLimit" 
                            size="small" 
                            class="theme-select"
                            popper-class="theme-select-popper"
                        >
                            <el-option label="10条" :value="10" />
                            <el-option label="20条" :value="20" />
                            <el-option label="30条" :value="30" />
                            <el-option label="40条" :value="40" />
                            <el-option label="50条" :value="50" />
                        </el-select>
                    </div>
                </div>
                <el-scrollbar class="hot-audio-scrollbar" max-height="320px">
                    <div class="hot-audio-grid">
                        <div 
                            v-for="(item, index) in hotAudioList" 
                            :key="item.id" 
                            class="hot-audio-item"
                            @click="playHotAudio(item)"
                        >
                            <span class="hot-audio-rank" :class="{ 'top-three': index < 3 }">{{ index + 1 }}</span>
                            <div class="hot-audio-info">
                                <span class="hot-audio-name" :title="item.name">{{ item.name }}</span>
                                <span class="hot-audio-tag">{{ item.tagName }}</span>
                            </div>
                            <span class="hot-audio-count">
                                <el-icon><VideoPlay /></el-icon>
                                {{ formatCount(item.playCount) }}
                            </span>
                        </div>
                    </div>
                    <el-empty v-if="hotAudioList.length === 0" description="暂无祝词" :image-size="60" />
                </el-scrollbar>
            </div>

            <div v-if="loading" class="loading-container">
                <div class="loading-fox">
                    <span class="fox-tail"></span>
                    <span class="fox-tail"></span>
                    <span class="fox-tail"></span>
                </div>
                <p>祝词加载中...</p>
            </div>
            <div v-else-if="error" class="error-state">
                <el-empty description="结缘失败" :image-size="80">
                    <template #image><el-icon size="80" class="error-icon"><Warning /></el-icon></template>
                    <el-button @click="fetchAudioList" class="kamihome-btn">重新祈愿</el-button>
                </el-empty>
            </div>
            <div v-else-if="audioSections.length === 0" class="empty-state">
                <el-empty description="暂无祝词" :image-size="80">
                    <template #image><el-icon size="80" class="empty-icon"><VideoPlay /></el-icon></template>
                </el-empty>
            </div>

            <div v-else class="sections">
                <div v-for="(section, sidx) in audioSections" :key="section.id" class="section-card kamihome-card">
                    <div class="section-header">
                        <h3>🎴 {{ section.title }}</h3>
                        <div class="section-actions">
                            <div class="section-count">{{ section.items.length }} 首</div>
                            <el-button v-if="isAuthenticated" @click="downloadAudiosByTag(section)" class="kamihome-btn small" plain>
                                <el-icon><Download /></el-icon>
                            </el-button>
                        </div>
                    </div>
                    <div class="section-body">
                        <div v-for="(item, tidx) in section.items" :key="item.url" class="track-row">
                            <el-button
                                :type="currentSectionIndex === sidx && currentTrackIndex === tidx ? 'danger' : ''"
                                @click="playTrack(sidx, tidx)" class="audio-tag kamihome-btn" plain round>
                                {{ item.name }}
                            </el-button>
                        </div>
                    </div>
                </div>
            </div>

            <el-dialog v-model="uploadDialogVisible" title="🎵 奉纳祝词" width="600px" :close-on-click-modal="false" custom-class="kamihome-dialog">
                <el-form :model="uploadForm" :rules="uploadFormRules" ref="uploadFormRef">
                    <el-form-item prop="audioFile">
                        <el-upload ref="uploadRef" :on-change="handleFileChange" :auto-upload="false" :show-file-list="true" accept="audio/mpeg,audio/mp3" action="" drag :limit="1" :on-exceed="handleFileExceed" style="width: 100%;">
                            <el-icon class="el-icon--upload"><component :is="UploadFilled" /></el-icon>
                            <div class="el-upload__text">将 MP3 祝词拖到此处，或 <em>点击选择</em></div>
                            <template #tip><div class="el-upload__tip">只支持 MP3 格式，单个文件大小不超过 5MB</div></template>
                        </el-upload>
                    </el-form-item>
                    <el-form-item label="祝词名称" prop="audioName">
                        <el-input v-model="uploadForm.audioName" placeholder="请输入祝词名称" maxlength="50" show-word-limit />
                    </el-form-item>
                    <el-form-item label="祝词类别" prop="audioTag">
                        <el-select v-model="uploadForm.audioTag" placeholder="请选择或输入类别" style="width: 100%" @change="handleTagSelect" filterable allow-create>
                            <el-option v-for="tag in tagOptions" :key="tag.value" :label="tag.label" :value="tag.value" />
                        </el-select>
                        <div class="tag-tip">💮 输入新类别名称可创建新绘马</div>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <span class="dialog-footer">
                        <el-button @click="closeUploadDialog" class="kamihome-btn">取消</el-button>
                        <el-button type="danger" @click="handleUpload" class="kamihome-btn">奉纳</el-button>
                    </span>
                </template>
            </el-dialog>

            <el-dialog v-model="aiMatchDialogVisible" title="✨ 神谕匹配" width="700px" :close-on-click-modal="false" custom-class="kamihome-dialog">
                <div class="ai-match-intro">
                    <p>描述你想要的祝词，神使将为你寻找最契合的缘</p>
                    <p class="ai-match-tip">💮 例如：活泼的狐狸、温柔的巫女等</p>
                </div>
                <el-form :model="aiMatchForm" :rules="aiMatchFormRules" ref="aiMatchFormRef">
                    <el-form-item prop="description">
                        <el-input v-model="aiMatchForm.description" type="textarea" :rows="4" placeholder="请描述你想要的祝词类型、风格或用途..." maxlength="500" show-word-limit resize="none" />
                    </el-form-item>
                </el-form>
                <div v-if="aiMatchResults.length > 0">
                    <div v-if="aiMatchReason" class="ai-reason-section">
                        <div class="reason-header">
                            <span class="reason-title">🦊 神谕启示</span>
                            <span v-if="isTypingReason" class="typing-indicator">
                                <span class="typing-dot">.</span><span class="typing-dot">.</span><span class="typing-dot">.</span>
                            </span>
                        </div>
                        <div class="reason-content">
                            {{ aiMatchReasonDisplay }}<span v-if="isTypingReason" class="cursor">|</span>
                        </div>
                    </div>
                    <div class="matched-audios">
                        <div v-for="audioId in aiMatchResults" :key="audioId" class="matched-audio-item">
                            <el-button @click="playMatchedAudio(audioId)" class="kamihome-btn" plain round>
                                {{ getAudioNameById(audioId) }}
                            </el-button>
                        </div>
                    </div>
                </div>
                <template #footer>
                    <span class="dialog-footer">
                        <el-button @click="closeAIMatchDialog" class="kamihome-btn">关闭</el-button>
                        <el-button type="danger" @click="handleAIMatch" :loading="aiMatchLoading" :disabled="!aiMatchForm.description.trim()" class="kamihome-btn">
                            祈愿匹配
                        </el-button>
                    </span>
                </template>
            </el-dialog>
        </div>
    </div>
</template>

<style scoped>
.kamihome-audio-page {
    min-height: 100vh;
    background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 40%, #fef7f0 100%);
    background-image: 
        radial-gradient(circle at 20% 30%, rgba(220, 180, 140, 0.1) 0%, transparent 30%),
        radial-gradient(circle at 80% 70%, rgba(200, 150, 120, 0.08) 0%, transparent 40%),
        repeating-linear-gradient(45deg, rgba(230, 180, 150, 0.02) 0px, rgba(230, 180, 150, 0.02) 6px, transparent 6px, transparent 18px);
    font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
    padding: 24px 0;
    overflow-x: hidden;
}

.container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 24px;
}

.shrine-hero {
    text-align: center;
    margin-bottom: 32px;
    padding: 48px 20px;
    background: rgba(255, 250, 240, 0.7);
    backdrop-filter: blur(5px);
    border: 2px solid #c33a2b;
    border-radius: 20px 20px 20px 6px;
    box-shadow: 0 5px 0 #9b2a1a, 0 8px 16px rgba(160, 60, 40, 0.1);
    position: relative;
    overflow: hidden;
}

.hero-content {
    position: relative;
    z-index: 1;
}

.hero-title {
    font-size: clamp(2rem, 5vw, 3.2rem);
    color: #5e2c1a;
    margin-bottom: 8px;
    font-weight: 700;
    text-shadow: 3px 3px 0 #f0d8c0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    flex-wrap: wrap;
}

.hero-icon {
    font-size: 2.5rem;
}

.hero-subtitle {
    font-size: 1.2rem;
    color: #7a3a28;
    font-style: italic;
}

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
    padding: 4px 12px;
    font-size: 13px;
}

.controls-card {
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
    flex-wrap: wrap;
}

.controls-main {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.control-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

.now-playing {
    color: #5e2c1a;
    font-weight: 500;
}

.hot-audio-card {
    flex-direction: column;
    align-items: stretch;
}

.hot-audio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px dashed #c33a2b;
    flex-wrap: wrap;
    gap: 10px;
}

.hot-audio-title {
    margin: 0;
    color: #5e2c1a;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.hot-audio-controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

/* 主题化单选按钮组 */
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

/* 主题化下拉选择器 */
.theme-select {
    width: 80px;
}

.theme-select :deep(.el-input__wrapper) {
    background: #f5e6d3 !important;
    border: 1.5px solid #c33a2b !important;
    border-radius: 20px !important;
    box-shadow: 0 2px 0 #9b2a1a !important;
    padding: 0 8px;
}

.theme-select :deep(.el-input__inner) {
    color: #5e2c1a !important;
    font-weight: 600;
}

.theme-select :deep(.el-select__caret) {
    color: #c33a2b !important;
}

/* 下拉菜单弹出层样式 */
:global(.theme-select-popper) {
    background: #fef7f0 !important;
    border: 2px solid #c33a2b !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 0 #9b2a1a !important;
}

:global(.theme-select-popper .el-select-dropdown__item) {
    color: #5e2c1a !important;
    font-weight: 500;
}

:global(.theme-select-popper .el-select-dropdown__item.is-selected) {
    background: #fce4d6 !important;
    color: #c33a2b !important;
    font-weight: 700;
}

:global(.theme-select-popper .el-select-dropdown__item:hover) {
    background: #f5e6d3 !important;
}

.hot-audio-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

.hot-audio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    background: rgba(245, 230, 211, 0.4);
    border: 1px solid rgba(200, 60, 40, 0.2);
}

.hot-audio-item:hover {
    background: #fce4d6;
    transform: translateY(-2px);
    box-shadow: 0 3px 0 #9b2a1a;
}

.hot-audio-rank {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-weight: 600;
    font-size: 12px;
    color: #5e2c1a;
    background: #e8e0d4;
    flex-shrink: 0;
}

.hot-audio-rank.top-three {
    background: #c33a2b;
    color: white;
}

.hot-audio-info {
    flex: 1;
    min-width: 0;
}

.hot-audio-name {
    color: #5e2c1a;
    font-weight: 500;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hot-audio-tag {
    background: #f5e6d3;
    color: #7a3a28;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    display: inline-block;
}

.hot-audio-count {
    display: flex;
    align-items: center;
    gap: 3px;
    color: #5e2c1a;
    font-size: 12px;
    flex-shrink: 0;
}

.loading-container {
    text-align: center;
    padding: 60px;
    color: #5e2c1a;
}

.loading-fox {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
}

.fox-tail {
    width: 10px;
    height: 30px;
    background: #c33a2b;
    border-radius: 10px 10px 2px 2px;
    animation: foxSway 1.2s infinite ease-in-out;
}

@keyframes foxSway {
    0%, 100% { transform: rotate(-10deg); }
    50% { transform: rotate(10deg); }
}

.sections {
    column-count: 3;
    column-gap: 20px;
}

.section-card {
    padding: 20px;
    margin-bottom: 20px;
    break-inside: avoid;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px dashed #c33a2b;
    flex-wrap: wrap;
    gap: 10px;
}

.section-header h3 {
    color: #5e2c1a;
    margin: 0;
    font-size: 18px;
}

.section-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-count {
    background: #f5e6d3;
    color: #5e2c1a;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid #c33a2b;
}

.section-body {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.audio-tag {
    background: #fce4d6 !important;
    border-color: #c33a2b !important;
    color: #5e2c1a !important;
}

:deep(.kamihome-dialog) {
    background: #fef7f0 !important;
    border: 3px solid #c33a2b !important;
    border-radius: 20px !important;
    box-shadow: 0 6px 0 #9b2a1a !important;
    max-width: 95vw;
}

:deep(.kamihome-dialog .el-dialog__header) {
    border-bottom: 2px dashed #c33a2b;
}

:deep(.kamihome-dialog .el-dialog__title) {
    color: #5e2c1a;
    font-weight: 600;
}

.ai-match-intro {
    background: #fce4d6;
    border-left: 4px solid #c33a2b;
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 20px;
}

.ai-reason-section {
    background: #f5e6d3;
    padding: 16px;
    border-radius: 12px;
    margin-top: 16px;
    border: 1px dashed #c33a2b;
}

.matched-audios {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 15px;
}

@media (max-width: 1200px) {
    .sections { column-count: 2; }
    .hot-audio-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
    .container { padding: 0 16px; }
    .sections { column-count: 1; }
    .hot-audio-grid { grid-template-columns: 1fr; }
    .controls-card { flex-direction: column; align-items: stretch; }
    .hero-title { font-size: 2rem; }
    .control-group { justify-content: center; }
    .kamihome-btn { padding: 6px 14px; font-size: 13px; }
    .now-playing { text-align: center; }
    .hot-audio-controls { justify-content: center; }
}

@media (max-width: 480px) {
    .kamihome-audio-page { padding: 12px 0; }
    .shrine-hero { padding: 30px 15px; }
    .hero-title { font-size: 1.6rem; }
    .hero-subtitle { font-size: 1rem; }
    .controls-card { padding: 16px; }
    .section-card { padding: 16px; }
    .hot-audio-header { flex-direction: column; align-items: flex-start; }
    .hot-audio-controls { width: 100%; justify-content: space-between; }
    .theme-select { width: 70px; }
}
</style>