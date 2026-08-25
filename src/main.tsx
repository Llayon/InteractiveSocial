import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { bootstrap } from './app/bootstrap'
import { createTelegramAdapter } from './platform/telegram'
import '@/design/tokens.css'
import '@/design/styles.css'

const telegram = createTelegramAdapter()
bootstrap({ telegram })

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing')
}

createRoot(container).render(
  <StrictMode>
    <App telegram={telegram} />
  </StrictMode>,
)
