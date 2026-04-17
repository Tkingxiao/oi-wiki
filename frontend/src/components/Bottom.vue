<script setup>
import gitee from '@/assets/gitee.png'
import github from '@/assets/github.png'

const platformLinks = [
    { name: 'Gitee', icon: gitee, url: 'https://gitee.com/jing-xiao/oi-wiki/' },
    { name: 'GitHub', icon: github, url: 'https://github.com/Tkingxiao/oi-wiki/' }
];

const currentYear = new Date().getFullYear()
</script>

<template>
    <footer class="kamihome-bottom-bar">
        <div class="container">
            <!-- 主要内容 -->
            <div class="footer-main">
                <!-- 左侧：品牌 -->
                <div class="footer-brand">
                    <div class="brand-text">
                        <span class="brand-name">
                            <span class="brand-icon">🦊</span> 黛棠OI-WIKI <span class="brand-icon">⛩️</span>
                        </span>
                        <span class="brand-tag">～ 分享奇妙回响 ～</span>
                    </div>
                </div>

                <!-- 中间：平台链接 -->
                <div class="footer-platforms">
                    <a v-for="platform in platformLinks" :key="platform.name" :href="platform.url" target="_blank"
                        :title="platform.name" class="platform-link">
                        <img :src="platform.icon" alt="" class="platform-icon">
                    </a>
                </div>

                <!-- 右侧：版权 -->
                <div class="footer-copyright">
                    <div>&copy; {{ currentYear }} 黛棠OI-WIKI</div>
                    <a href="https://beian.miit.gov.cn" target="_blank" class="beian-link">琼ICP备2025062133号</a>
                </div>
            </div>
        </div>
        <!-- 装饰分割线 -->
        <div class="footer-decoration"></div>
    </footer>
</template>

<style scoped>
.kamihome-bottom-bar {
    width: 100%;
    background: linear-gradient(145deg, #f9f3e7 0%, #f5e6d3 100%);
    border-top: 3px solid #c33a2b;
    box-shadow: 0 -4px 0 #9b2a1a, 0 -6px 12px rgba(160, 60, 40, 0.1);
    position: relative;
    margin-top: auto;
    overflow: hidden;
    font-family: 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
    position: relative;
    z-index: 1;
}

/* 主要内容水平布局 */
.footer-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 0;
    flex-wrap: wrap;
    gap: 15px;
}

/* 品牌区域 */
.footer-brand {
    display: flex;
    align-items: center;
    gap: 15px;
}

.brand-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.brand-name {
    font-size: 20px;
    font-weight: 700;
    color: #5e2c1a;
    letter-spacing: 0.5px;
    text-shadow: 1px 1px 0 #f0d8c0;
    display: flex;
    align-items: center;
    gap: 6px;
}

.brand-icon {
    font-size: 22px;
    filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));
}

.brand-tag {
    font-size: 13px;
    color: #7a3a28;
    font-weight: 400;
    padding-left: 6px;
}

/* 平台链接区域 */
.footer-platforms {
    display: flex;
    align-items: center;
    gap: 24px;
}

.platform-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #fce4d6;
    border: 2px solid #c33a2b;
    box-shadow: 0 3px 0 #9b2a1a, 0 2px 8px rgba(160, 60, 40, 0.15);
    text-decoration: none;
    transition: all 0.2s ease;
}

.platform-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 0 #9b2a1a, 0 4px 12px rgba(200, 60, 40, 0.3);
    background: #c33a2b;
}

.platform-icon {
    width: 24px;
    height: 24px;
    filter: brightness(0) saturate(100%) invert(25%) sepia(28%) saturate(1250%) hue-rotate(338deg) brightness(92%) contrast(95%);
    transition: filter 0.2s ease;
}

.platform-link:hover .platform-icon {
    filter: brightness(0) invert(1);
}

/* 版权信息 */
.footer-copyright {
    font-size: 14px;
    color: #5e2c1a;
    font-weight: 500;
    text-align: right;
}

.beian-link {
    color: #7a3a28;
    text-decoration: none;
    transition: all 0.2s ease;
    font-size: 13px;
}

.beian-link:hover {
    color: #c33a2b;
    text-decoration: underline;
}

/* 底部装饰分割线 */
.footer-decoration {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: repeating-linear-gradient(90deg, #c33a2b, #c33a2b 8px, transparent 8px, transparent 16px);
    opacity: 0.3;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .container {
        padding: 0 15px;
    }

    .footer-main {
        flex-direction: column;
        gap: 20px;
        padding: 28px 0;
        text-align: center;
    }

    .footer-brand {
        justify-content: center;
    }

    .footer-platforms {
        justify-content: center;
    }

    .footer-copyright {
        font-size: 13px;
        text-align: center;
    }

    .brand-name {
        font-size: 18px;
    }
}

@media (max-width: 480px) {
    .footer-main {
        padding: 24px 0;
        gap: 16px;
    }

    .footer-brand {
        gap: 10px;
    }

    .brand-name {
        font-size: 16px;
    }

    .platform-link {
        width: 38px;
        height: 38px;
    }

    .platform-icon {
        width: 20px;
        height: 20px;
    }

    .footer-copyright {
        font-size: 12px;
    }

    .beian-link {
        font-size: 12px;
    }
}
</style>
