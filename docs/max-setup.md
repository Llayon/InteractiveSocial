# MAX Mini App — Production Setup

## Required env (Vercel)

Server-only (never `VITE_`):

```text
MAX_BOT_TOKEN=                 # secret
MAX_BOT_USERNAME=se14154487_bot
APP_BASE_URL=https://tginteractive.vercel.app

# Recommended for platform-api2.max.ru on Vercel:
MAX_EXTRA_CA_PEM=              # full Russian Trusted CA PEM chain
# Alternative only when the file is guaranteed to exist in the Function runtime:
MAX_EXTRA_CA_PATH=

TELEGRAM_BOT_TOKEN=...         # existing
TELEGRAM_BOT_USERNAME=...
```

Client public (baked at build):

```text
VITE_MAX_BOT_USERNAME=se14154487_bot
VITE_TELEGRAM_BOT_USERNAME=...
```

`MAX_BOT_TOKEN` must never appear in `dist/` — verified via `scripts/check-max-token-not-in-bundle.mjs`.

### Important env rules

- `APP_BASE_URL` must be the stable public alias that actually serves the share assets, for example `https://tginteractive.vercel.app`. Do not use an arbitrary Vercel deployment URL: SPA rewrites can return `text/html` instead of the JPEG asset path.
- Prefer `MAX_EXTRA_CA_PEM` for MAX API TLS on Vercel. The MAX HTTP client scopes this CA to MAX requests via `undici.Agent`; it does not disable TLS verification globally.
- Do **not** rely on `NODE_EXTRA_CA_CERTS` pointing to a file that is created later at runtime. Node reads that variable during process startup. A missing path produces `Ignoring extra certs ... No such file` and does not help subsequent fetches.
- Never use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## K0 — Verify canonical username and TLS

`GET https://platform-api2.max.ru/me` with `Authorization: <token>` is the source of truth.

Local:

```text
MAX_BOT_TOKEN=... node scripts/max-spike.mjs
```

Expected:

```text
MAX BOT:
  user_id: <id>
  username: se14154487_bot
  is_bot: true
```

Canonical Mini App link:

```text
https://max.ru/se14154487_bot?startapp=quiz_music90s
```

On Vercel use the MAX health/debug path or production logs from `maxGetMe`. Never log the token.

If `username` is absent or `is_bot !== true` → K0 FAIL.

If the request fails with `unable to get local issuer certificate` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, treat it as a CA/runtime problem before debugging share logic.

## TLS — Russian Trusted CA

MAX API calls go to:

```text
https://platform-api2.max.ru
```

The production client in `api/_lib/maxApi.ts` uses static ESM imports and a scoped `undici.Agent({ connect: { ca } })` when `MAX_EXTRA_CA_PEM` / `MAX_EXTRA_CA_PATH` is configured.

This is intentional. A previous implementation used runtime `require('undici')`; in Vercel ESM that could evaluate to `require is not defined`, silently fall back to global `fetch`, and then fail TLS despite the PEM being present.

Production invariant:

```text
MAX_EXTRA_CA_PEM present
→ undici Agent available
→ /me reaches MAX over TLS
→ bad/dummy token returns HTTP 401, not network_error
```

A `401` with a deliberately invalid token is therefore a useful TLS probe: the connection succeeded and MAX rejected authentication normally.

## Deep links

```text
Telegram: https://t.me/<bot>/<app>?startapp=s2_<quiz>_<result>_<uid>
MAX:      https://max.ru/se14154487_bot?startapp=s2_<quiz>_<result>_<uid>
```

Wire format `s2_...` is identical; resolver `resolveQuizFromLaunch` remains generic.

## Result delivery

- Telegram: `POST /api/results/deliver`
- MAX: `POST /api/max/results/deliver`

MAX delivery validates signed initData, resolves the exact result/score card server-side, creates the MAX image attachment, sends the user's own card, and optionally notifies the original sharer when attribution is valid and same-quiz.

The response is truthful:

```text
{ ok: true, deliveredSelf: boolean, deliveredSharer: boolean }
```

`ok: true` only means the endpoint handled the request. Always inspect `deliveredSelf` / `deliveredSharer` when diagnosing missing bot notifications.

## Share

Telegram:

```text
POST /api/share/prepare
→ savePreparedInlineMessage
→ WebApp.shareMessage(id)
```

MAX:

```text
POST /api/max/share/prepare
→ prepare image attachment
→ POST /messages
→ receive message.body.mid
→ window.WebApp.shareMaxContent({ mid, chatType: 'DIALOG' })
```

If prepare fails, the client deliberately degrades to text/link sharing. Symptom: recipient picker still opens, but the recipient receives only a normal link rather than the visual result card.

Therefore:

```text
picker opens + only link arrives
≈ inspect /api/max/share/prepare and maxSendMessage first
```

Do not misdiagnose that symptom as a Bridge/user-gesture failure.

## MAX image transport

The current production path is shared by both:

- `api/max/share/prepare.ts`
- `api/max/results/deliver.ts`

through `api/_lib/maxMedia.ts`.

Preferred flow:

```text
share-card URL
→ preflight (2xx + image/jpeg/png)
→ read image bytes server-side
→ POST /uploads?type=image
→ multipart upload to returned upload URL
→ receive MAX image token
→ POST /messages with { type: 'image', payload: { token } }
```

A controlled external-URL path/retry may exist, but token upload is the reliable production transport. Do not maintain separate media implementations for challenge share and result delivery.

For Music90s, exact-score cards are versioned, for example:

```text
https://tginteractive.vercel.app/share-cards/v2/m90_score_10.jpg
```

Before blaming MAX, verify the exact production URL returns:

```text
HTTP 200
Content-Type: image/jpeg
non-zero bytes
```

## Production incident — 2026-09-04

### Symptoms

- MAX recipient picker opened normally.
- Recipient received only text/link instead of the visual card.
- After quiz completion, the MAX bot stopped delivering the user's result card.
- The previous day result notifications had worked.

### Root cause

The common MAX backend transport could not establish TLS to `platform-api2.max.ru`:

1. `MAX_EXTRA_CA_PEM` existed in Vercel.
2. `NODE_EXTRA_CA_CERTS` pointed to `/var/task/certs/russian-trusted-ca.pem`, but that file did not exist at Node startup.
3. `api/_lib/maxApi.ts` attempted to load `undici` via `require()` in an ESM Function.
4. `require` was unavailable, so the scoped CA dispatcher was not created.
5. Code fell back to global `fetch` without the required CA.
6. `/me`, `/uploads`, and `/messages` all failed with `network_error` / `unable to get local issuer certificate`.

The new `/share-cards/v2/...` path was initially suspicious because the regression appeared after that deployment, but forensic preflight proved the asset itself was healthy (`200 image/jpeg`). The actual shared failure point was TLS to the MAX API.

### Why the two user-facing failures appeared together

Challenge share:

```text
/api/max/share/prepare
→ MAX /messages network_error
→ no mid
→ client fallbackShare({ text, link })
→ recipient gets plain link
```

Result delivery:

```text
/api/max/results/deliver
→ MAX /messages network_error
→ deliveredSelf=false
→ no bot result message
```

### Fix

- Static ESM imports for `fs`, `path`, `https`, `undici`.
- Scoped `undici.Agent` with configured CA.
- Shared `maxMedia` transport for share + deliver.
- Official image upload-token flow.
- Safe structured diagnostics for MAX API and media phases.
- Client telemetry distinguishes prepared-mid share from text fallback.

Production confirmation after fix:

```text
MAX TLS probe reaches HTTP response
GET /me succeeds with valid bot token
visual MAX share works on real client
bot result delivery works on real client
```

### Regression signature to remember

If both visual share and result delivery fail at the same time, check the common MAX API/TLS/media layer before changing UI, deeplinks, scoring, or Telegram code.

## Diagnostics / logs

Useful safe log families:

```text
[max]        operation=me|uploads|messages status=... ok=...
[max-media]  phase=preflight|upload-request|upload|message ...
[max-share]  prepare=success|failed mid=present|missing transport=prepared_mid|fallback_text
[max-deliver] target=self|sharer media=... ok=...
```

Never log:

- `MAX_BOT_TOKEN`
- raw initData
- signature/hash
- full signed user payload

Useful interpretations:

```text
status=0 / network_error
→ transport/TLS/network problem before MAX returned HTTP

HTTP 401 with intentionally invalid token
→ TLS is working; authentication failed normally

preflight=200 image/jpeg + /messages network_error
→ asset is healthy; investigate MAX API transport/TLS

share transport=fallback_text
→ user received link fallback, not prepared visual card

deliveredSelf=false
→ endpoint ran but the bot did not deliver the result card
```

## Mock

```text
?mock=1&platform=max&startapp=s2_m90_lg_123456  # MAX mock
?mock=1                                        # Telegram mock (backward compatibility)
```

Mocks are useful for deterministic UI/contract coverage, but they do **not** replace a real MAX device check for:

- visual image delivery
- real `mid`
- recipient picker behavior
- bot result delivery
- attribution between two real users

Never mark MAX media DONE solely because mock Playwright is green.

## Analytics

MAX share diagnostics include explicit prepare / mid / bridge / fallback events so a plain-link fallback is distinguishable from a prepared visual share.

Do not treat `shareMaxContent()` returning without throwing as proof that a recipient actually received the media card.

## Security checklist

- [ ] `MAX_BOT_TOKEN` server-only, not in `dist/`
- [ ] `Authorization:` header, not query
- [ ] `platform-api2.max.ru` exact domain
- [ ] `MAX_EXTRA_CA_PEM` configured when Vercel needs the Russian Trusted CA chain
- [ ] no `NODE_TLS_REJECT_UNAUTHORIZED=0`
- [ ] no dependency on a missing `NODE_EXTRA_CA_CERTS` runtime file
- [ ] `validateMaxInitData` rejects tampered/duplicate/stale/future/malformed
- [ ] score validated against bands, `resultId` against registry
- [ ] `imageUrl` server-derived
- [ ] stable `APP_BASE_URL` alias serves the real share-card bytes
- [ ] share and delivery use the same MAX media helper
- [ ] Sharer notification platform-scoped, cross-quiz suppressed, self-suppressed

## Real device QA

- [ ] `https://max.ru/se14154487_bot?startapp=quiz_music90s` opens
- [ ] Complete Music90s → own bot result card arrives
- [ ] Share → native recipient picker opens
- [ ] Recipient gets the visual image card, not only a text/link fallback
- [ ] CTA opens the same quiz
- [ ] `s2` attribution survives; friend completion can notify sharer
- [ ] Interior quiz uses the same MAX transport correctly
- [ ] Telegram iOS/Android remains unaffected

If no device/token is available, mark `BLOCKED_REAL_ENV`, not PASS.

## Deploy

1. Add/verify `MAX_BOT_TOKEN`, `MAX_BOT_USERNAME`, `VITE_MAX_BOT_USERNAME`, `APP_BASE_URL`, and CA env in Vercel Production/Preview as appropriate.
2. Run quality gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` plus relevant Playwright/MAX regressions.
3. Deploy production.
4. Verify Vercel deployment status is green.
5. Verify `/me` through the production Function/runtime.
6. Run one real MAX share and one real MAX completion.
7. Confirm visual share and bot result delivery on-device before declaring the transport healthy.
