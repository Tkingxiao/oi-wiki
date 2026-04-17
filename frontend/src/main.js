import './assets/index.css'
import 'element-plus/dist/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import App from './App.vue'
import router from './router'
import Avatar from '@/components/Avatar.vue'

const app = createApp(App)

app.use(router)
app.use(ElementPlus)

const pinia = createPinia()
app.use(pinia)

app.component('Avatar', Avatar)

import { useUserStore } from '@/stores/user'
const userStore = useUserStore(pinia)

const initializeApp = async () => {
    try {
        await userStore.initializeAuth()
    } catch (error) {
        console.warn('Failed to initialize auth:', error)
    }
    app.mount('#app')
}

initializeApp()