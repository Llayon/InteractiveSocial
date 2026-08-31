# MAX Mini App — Production Setup

## Required env (Vercel)

Server-only (never `VITE_`):
```
MAX_BOT_TOKEN=           # from MAX BotFather-like, treat as secret
MAX_BOT_USERNAME=se14154487_bot
APP_BASE_URL=https://your-app.vercel.app
TELEGRAM_BOT_TOKEN=...   # existing
TELEGRAM_BOT_USERNAME=...
```

Client public (baked at build):
```
VITE_MAX_BOT_USERNAME=se14154487_bot
VITE_TELEGRAM_BOT_USERNAME=...
```

`MAX_BOT_TOKEN` must never appear in `dist/` — verified via `scripts/check-max-token-not-in-bundle.mjs` (grep dist).

## K0 — Verify canonical username

`GET https://platform-api2.max.ru/me` with `Authorization: <token>` is source of truth.

Local:
```
MAX_BOT_TOKEN=... node scripts/max-spike.mjs
# expect:
# MAX BOT:
#   user_id: 123
#   username: se14154487_bot
#   is_bot: true
# Canonical Mini App link: https://max.ru/se14154487_bot?startapp=quiz_music90s
```

On Vercel: `POST /api/max/health` proxy or direct `maxGetMe` log (never logs token).

If `username` absent or `is_bot !== true` → K0 FAIL.

## TLS — Russian Trusted CA

MAX docs require trusted cert chain including Минцифры. Vercel's system CA already includes it; if `platform-api2.max.ru` fails with `UNABLE_TO_VERIFY`, set scoped CA:

- `MAX_EXTRA_CA_PEM` = full PEM string, or
- `MAX_EXTRA_CA_PATH` = file path in Function

Scoped to `platform-api2.max.ru` only via custom `undici` Agent / `https.Agent` in `api/_lib/maxApi.ts` — never `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Deep links

```
Telegram: https://t.me/<bot>/<app>?startapp=s2_<quiz>_<result>_<uid>
MAX:      https://max.ru/se14154487_bot?startapp=s2_<quiz>_<result>_<uid>
```

Wire `s2_...` identical; resolver `resolveQuizFromLaunch` unchanged.

## Result delivery

- Telegram: `POST /api/results/deliver`
- MAX: `POST /api/max/results/deliver` (platform-scoped, dedup `max:<uid>:...`)

Both validate score bands, resolve `share-cards/*.jpg` server-side, never accept client image URL.

## Share

- Telegram: `POST /api/share/prepare` → `savePreparedInlineMessage` → `WebApp.shareMessage(id)`
- MAX: `POST /api/max/share/prepare` → `POST /messages` → `{ok:true, mid}` → `window.WebApp.shareMaxContent({mid, chatType:'DIALOG'})`

Requires user click. We implement strategy A (click→fetch→share). If MAX client rejects async boundary, use strategy B (pre-prepare mid on result screen, cache, click→immediate share). See `src/platform/share/ShareTransport.ts`.

Fallback: `shareMaxContent({text,link})` → `navigator.share` → clipboard with `max.ru/...` link (never raw Vercel URL).

## Mock

```
?mock=1&platform=max&startapp=s2_m90_lg_123456  # MAX mock
?mock=1                                        # Telegram mock (bc)
```

Mocks emulate `platform`, `user`, `initData`, `shareMaxContent` success/failed/unsupported without real signature.

## Analytics

All events carry `platform: telegram|max|browser|mock` via `baseContext`. No new event names.

## Security checklist

- [ ] `MAX_BOT_TOKEN` server-only, not in `dist/`
- [ ] `Authorization:` header, not query
- [ ] `platform-api2.max.ru` exact domain
- [ ] `validateMaxInitData` rejects tampered/duplicate/stale/future/malformed
- [ ] `score` validated against bands, `resultId` against registry
- [ ] `imageUrl` server-derived (`APP_BASE_URL/share-cards/...`)
- [ ] Sharer notification platform-scoped, cross-quiz suppressed, self-suppressed

## Real device QA (R1–R12)

- [ ] `https://max.ru/se14154487_bot?startapp=quiz_music90s` opens
- [ ] Complete Music90s → own card delivered
- [ ] Share → native picker opens
- [ ] Recipient gets image, CTA `https://max.ru/...?startapp=quiz_music90s` opens same quiz
- [ ] `s2` attribution survives, friend completes → sharer notified
- [ ] Interior same flow
- [ ] Telegram iOS/Android still works

If no device/token → mark `BLOCKED_REAL_ENV`, not PASS.

## Deploy

1. Add `MAX_BOT_TOKEN` + `MAX_BOT_USERNAME` + `VITE_MAX_BOT_USERNAME` in Vercel (Production+Preview)
2. `vercel deploy --prod --yes` after `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm playwright test`
3. Verify `GET /me` from production Function logs
4. Verify production bundle has no `MAX_BOT_TOKEN`
