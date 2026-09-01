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

// Load MAX Bridge only for detected MAX launch, non-blocking, bounded timeout.
// Do not block first paint; failure must not leave white screen.
// The static parser-blocking script was removed from index.html per P0 fix.
if (platformAdapter.platform === 'max') {
  void import('./platform/max/bridge.js')
    .then(({ ensureMaxBridgeLoaded }) => ensureMaxBridgeLoaded())
    .catch(() => {
      /* bridge load failure must not break app — haptics/share degrade */
    })
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing')
}

createRoot(container).render(
  <StrictMode>
    <App telegram={telegram} adapter={platformAdapter} />
  </StrictMode>,
)
