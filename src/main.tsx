import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { bootstrap } from './app/bootstrap'
import { createPlatformAdapter } from './platform/factory'
import '@/design/tokens.css'
import '@/design/styles.css'

const platformAdapter = createPlatformAdapter()
const telegram = platformAdapter as unknown as import('./platform/telegram').TelegramAdapter
bootstrap({ telegram, adapter: platformAdapter })

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing')
}

createRoot(container).render(
  <StrictMode>
    <App telegram={telegram} adapter={platformAdapter} />
  </StrictMode>,
)
