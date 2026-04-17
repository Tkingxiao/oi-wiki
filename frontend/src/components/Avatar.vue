<template>
  <img
    :src="src"
    :alt="alt"
    :width="width"
    :height="height"
    :class="customClass"
    referrerpolicy="no-referrer"
    @error="handleError"
  />
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: '头像'
  },
  width: {
    type: [String, Number],
    default: 40
  },
  height: {
    type: [String, Number],
    default: 40
  },
  customClass: {
    type: String,
    default: ''
  },
  fallbackSrc: {
    type: String,
    default: 'https://i0.hdslb.com/bfs/face/member/noface.jpg'
  }
})

const emit = defineEmits(['error'])

const getAvatarUrl = (avatar) => {
  if (!avatar) return ''
  if (avatar.startsWith('/images/avatar/')) {
    return `/api${avatar}`
  }
  return avatar
}

const currentSrc = ref(getAvatarUrl(props.src) || props.fallbackSrc)

watch(() => props.src, (newSrc) => {
  currentSrc.value = getAvatarUrl(newSrc) || props.fallbackSrc
})

const handleError = () => {
    if (currentSrc.value !== props.fallbackSrc) {
        if (currentSrc.value.startsWith('http://')) {
            currentSrc.value = currentSrc.value.replace('http://', 'https://');
            return;
        }
        currentSrc.value = props.fallbackSrc;
        emit('error', props.src);
    }
}
</script>

<style scoped>
/* 可选：添加圆角样式 */
img {
  border-radius: 50%;
  object-fit: cover;
}
</style>