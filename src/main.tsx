import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ShareCardPreview } from './app/ShareCardPreview'
import { bootstrap } from './app/bootstrap'
import { createPlatformAdapter } from './platform/factory'
import '@/design/tokens.css'
import '@/design/styles.css'
import '@/design/music90s.css'

function pushStage(s: string) {
  try {
    const w = window as unknown as { __pushStage?: (s: string) => void }
    w.__pushStage?.(s)
  } catch {}
}

pushStage('MAIN_MODULE_STARTED')

const isShareCardPreview =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('shareCardPreview')

if (isShareCardPreview) {
  pushStage('SHARE_CARD_PREVIEW')
  const container = document.getElementById('root')
  if (!container) throw new Error('Root container #root is missing')
  document.body.style.margin = '0'
  document.body.style.background = '#f5efe7'
  const root = createRoot(container)
  root.render(<ShareCardPreview />)
} else {
pushStage('PLATFORM_DETECTION_STARTED')
const platformAdapter = createPlatformAdapter()
pushStage('PLATFORM_DETECTED:' + platformAdapter.platform)
pushStage('ADAPTER_CREATED')
const telegram = platformAdapter as unknown as import('./platform/telegram').TelegramAdapter
bootstrap({ telegram, adapter: platformAdapter })

// Platform bridges: load ONLY required bridge asynchronously, never parser-blocking.
// MAX launch → async load max-web-app.js
// Telegram launch → async load telegram-web-app.js (if not already present)
// Browser → neither
// All bridges have bounded timeout and never block first paint.
if (platformAdapter.platform === 'max') {
  pushStage('MAX_BRIDGE_LOAD_STARTED')
  void import('./platform/max/bridge.js')
    .then(({ ensureMaxBridgeLoaded }) => ensureMaxBridgeLoaded().then((v) => {
      pushStage(v ? 'MAX_BRIDGE_READY' : 'MAX_BRIDGE_FAILED:empty')
    }).catch((e) => {
      pushStage('MAX_BRIDGE_FAILED:' + (e instanceof Error ? e.name : 'unknown'))
    }))
    .catch((e) => {
      pushStage('MAX_BRIDGE_FAILED:' + (e instanceof Error ? e.name : 'unknown'))
    })
} else if (platformAdapter.platform === 'telegram') {
  pushStage('TELEGRAM_BRIDGE_LOAD_STARTED')
  void import('./platform/telegram/bridge.js')
    .then(({ ensureTelegramBridgeLoaded }) => ensureTelegramBridgeLoaded().then((v) => {
      pushStage(v ? 'TELEGRAM_BRIDGE_READY' : 'TELEGRAM_BRIDGE_FAILED:empty')
    }).catch((e) => {
      pushStage('TELEGRAM_BRIDGE_FAILED:' + (e instanceof Error ? e.name : 'unknown'))
    }))
    .catch((e) => {
      pushStage('TELEGRAM_BRIDGE_FAILED:' + (e instanceof Error ? e.name : 'unknown'))
    })
} else {
  pushStage('BRIDGE_SKIPPED:' + platformAdapter.platform)
}

const container = document.getElementById('root')
if (!container) {
  pushStage('REACT_CREATE_ROOT_FAILED')
  throw new Error('Root container #root is missing')
}
pushStage('REACT_CREATE_ROOT')
try {
  const root = createRoot(container)
  pushStage('REACT_RENDER_CALLED')
  root.render(
    <StrictMode>
      <App telegram={telegram} adapter={platformAdapter} />
    </StrictMode>,
  )
} catch (e) {
  pushStage('REACT_RENDER_FAILED:' + (e instanceof Error ? e.name : 'unknown'))
  throw e
}
// CSS visibility diagnostic after a tick (best-effort, no private data)
setTimeout(() => {
  try {
    const r = document.getElementById('root')
    const rect = r?.getBoundingClientRect()
    const cs = r ? getComputedStyle(r) : null
    const bodyTextLen = document.body.innerText.length
    pushStage('CSS_CHECK root rect ' + (rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : 'no-root') + ' display=' + (cs?.display ?? 'n/a') + ' opacity=' + (cs?.opacity ?? 'n/a') + ' vis=' + (cs?.visibility ?? 'n/a') + ' bodyLen=' + bodyTextLen)
  } catch {}
}, 100)
setTimeout(() => {
  try {
    const r2 = document.getElementById('root')
    const rect2 = r2?.getBoundingClientRect()
    pushStage('CSS_CHECK_2 root rect ' + (rect2 ? `${Math.round(rect2.width)}x${Math.round(rect2.height)}` : 'no-root') + ' bodyLen=' + document.body.innerText.length)
  } catch {}
}, 1000)
} // end non-preview
