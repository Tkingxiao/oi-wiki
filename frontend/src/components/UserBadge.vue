<template>
  <div class="user-badge-wrapper">
    <!-- 等级牌：黛言人 + 等级数字 -->
    <div class="level-badge" :style="levelStyle">
      <span class="level-text">黛言人</span>
      <span class="level-number">Lv.{{ level }}</span>
    </div>
    <!-- 身份牌：仅身份文字 -->
    <div class="role-badge" :class="roleClass">
      {{ roleText }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  level: { type: Number, default: 0 },
  badge: { type: String, default: '未上供' }
});

const getColorForLevel = (level) => {
  let hue, sat = 85, light = 55;
  if (level <= 20) {
    let t = level / 20;
    hue = 90 * t;
    light = 45 + t * 15;
    sat = 60 + t * 25;
  } else if (level <= 40) {
    let t = (level - 20) / 20;
    hue = 90 + (210 - 90) * t;
    light = 55 + t * 10;
    sat = 80;
  } else if (level <= 60) {
    let t = (level - 40) / 20;
    hue = 210 + (300 - 210) * t;
    light = 58 + t * 8;
    sat = 85;
  } else {
    let t = (level - 60) / 20;
    hue = 300 + (360 - 300) * t;
    light = 62 + t * 10;
    sat = 90;
  }
  light = Math.min(70, Math.max(45, light));
  return `hsl(${hue}, ${sat}%, ${light}%)`;
};

const levelStyle = computed(() => ({
  background: `linear-gradient(145deg, ${getColorForLevel(props.level)}, ${getColorForLevel(props.level - 10 > 0 ? props.level - 10 : 0)})`
}));

const roleMap = {
  '未上供': { class: 'role-none', text: '未上供' },
  '舰长': { class: 'role-captain', text: '舰长' },
  '提督': { class: 'role-admiral', text: '提督' },
  '总督': { class: 'role-governor', text: '总督' }
};
const roleInfo = computed(() => roleMap[props.badge] || roleMap['未上供']);
const roleClass = computed(() => roleInfo.value.class);
const roleText = computed(() => roleInfo.value.text);
</script>

<style scoped>
.user-badge-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;  /* 强制一行显示 */
}

.level-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  border-radius: 20px;
  padding: 2px 8px 2px 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid rgba(255,255,255,0.2);
}
.level-text {
  font-size: 10px;
  color: white;
  opacity: 0.9;
}
.level-number {
  font-size: 10px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.5px;
}

.role-badge {
  display: inline-block;
  border-radius: 20px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.role-none {
  background: #6c757d;
  color: #f8f9fa;
}
.role-captain {
  background: #409eff;
  color: white;
}
.role-admiral {
  background: #9b59b6;
  color: white;
}
.role-governor {
  background: #f56c6c;
  color: white;
}

/* 移动端进一步缩小 */
@media (max-width: 768px) {
  .level-badge {
    padding: 1px 6px 1px 8px;
  }
  .level-text, .level-number, .role-badge {
    font-size: 9px;
  }
  .role-badge {
    padding: 1px 6px;
  }
}
</style>