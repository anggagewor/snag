import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import './assets/styles/main.css'
import { startApp } from './services/startup'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Initialize services before mounting (migration, scratch pad, registry)
startApp()
  .then((result) => {
    // Expose startup result for App.vue to consume
    app.provide('startupResult', result)
    app.mount('#app')
  })
  .catch((err) => {
    console.error('[main] Startup failed:', err)
    // Mount anyway so user sees something
    app.mount('#app')
  })
