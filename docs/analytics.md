# Analytics — Production Relay

## Overview

```
Mini App → src/analytics/httpProvider.ts → POST /api/analytics → PostHog Capture API (official https://<host>/i/v0/e/)
```

- Client never calls PostHog directly.
- Same-origin `POST /api/analytics` only.
- Fire-and-forget: `fetch(..., { keepalive: true })`, analytics failure never blocks UX.
- Privacy: no Telegram/MAX user ids, no names, no tokens. Person Profiles disabled.
- Verified against official docs: https://posthog.com/docs/api/capture

## Environment

Server-only (Vercel Functions, never `VITE_`):

```text
POSTHOG_PROJECT_TOKEN=               # PostHog project token (ingestion write key, api_key) — required
POSTHOG_HOST=https://us.i.posthog.com  # optional — defaults to US Cloud; EU: https://eu.i.posthog.com
```

- `POSTHOG_PROJECT_TOKEN` must be set in Vercel Production/Preview; if missing, the relay returns 503 (`analytics_not_configured`) — client swallows it, UX unaffected but infrastructure failure is visible to monitoring.
- `POSTHOG_HOST` defaults to `https://us.i.posthog.com` when unset. For EU Cloud use `https://eu.i.posthog.com` (relay appends `/i/v0/e/` → `https://eu.i.posthog.com/i/v0/e/`). For self-hosted use your domain.
- Never prefix with `VITE_` — the token must not enter the client bundle, though project token is not a secret personal API key architecturally the client still only knows `/api/analytics`.

Client (optional override):

```text
VITE_ANALYTICS_PROVIDER=console|http  # dev only
# prod always uses http regardless of this var
# dev default: composite (http + console) for visibility
# test default: console (injected mock)
```

## Anonymous identity

- `anonymous_id` — per-browser install id. `crypto.randomUUID()` persisted in `localStorage:interactive_social_analytics_id`. If storage unavailable, ephemeral per-page id. `!==` Telegram/MAX user id.
- `session_id` — per app open. `crypto.randomUUID()` at bootstrap, ephemeral (not persisted). All events in one open share same `session_id`.
- `run_id` — per quiz run. Not implemented in this pass; backend accepts it as arbitrary safe property so later merge can add without migration.

All three attached via `baseContext` in `bootstrap()` so every `getAnalytics().track(...)` automatically includes them.

## Events

Canonical events already emitted by the app (examples):

```text
app_open, quiz_view, quiz_landing_view, quiz_start, question_answered,
quiz_complete, result_view, share_click, challenge_click,
channel_promo_impression, channel_click, quiz_restart_click, ...
```

After this change they are forwarded automatically — no call-site change required.

Example:

```ts
getAnalytics().track('quiz_start', { quiz_id: 'music90s' })
```

is sent as:

```json
{
  "event": "quiz_start",
  "properties": {
    "quiz_id": "music90s",
    "platform": "max",
    "entry_source": "challenge",
    "anonymous_id": "…",
    "session_id": "…"
  }
}
```

relay converts to PostHog (official single-event ingestion at `/i/v0/e/`):

```json
{
  "api_key": "<POSTHOG_PROJECT_TOKEN>",
  "event": "quiz_start",
  "distinct_id": "<anonymous_id>",
  "properties": {
    "quiz_id": "music90s",
    "platform": "max",
    "$process_person_profile": false,
    "$geoip_disable": true,
    "$ip": null
  }
}
```

- `distinct_id = anonymous_id` (never platform user id).
- `$process_person_profile: false` disables Person Profiles — we only need aggregate product analytics per official anonymous event capture docs.
- `$geoip_disable: true` + `$ip: null` ensure Vercel server IP is not stored as user IP and GeoIP enrichment is skipped (see posthog-plugin-geoip README). Project-level "Discard client IP data" should also be enabled for GDPR.
- `api_key` is the project token (field name remains `api_key` per official payload, env is `POSTHOG_PROJECT_TOKEN`).

## API

`POST /api/analytics`

Request:

```json
{
  "event": "quiz_start",
  "properties": { "quiz_id": "music90s", "platform": "max" }
}
```

- `event` — required, non-empty string ≤ 100 chars.
- `properties` — optional plain object (not array), ≤ 32 KB total payload, ≤ 100 keys, depth ≤ 5, no `__proto__`/`constructor`/`prototype`.
- Forbidden keys (`telegram_user_id`, `username`, `initData`, `token`, `chat_id`, `question_text`, etc.) are stripped before forwarding.

Responses (sequential contract):

- `204` — accepted and PostHog ingestion succeeded.
- `400` — malformed input, empty event, array properties, prototype pollution, giant strings, etc.
- `405` — non-POST method.
- `413` — payload too large (>32KB).
- `503` — `POSTHOG_PROJECT_TOKEN` not configured (analytics_not_configured).
- `502` — PostHog timeout/down/non-2xx (posthog_error). AbortController timeout ~4s, bounded.

Client provider swallows 5xx — `getAnalytics().track(...)` never throws, no toast, no retry, no navigation block. Infrastructure 5xx is visible to server monitoring but never breaks quiz UX.

## Validation / Abuse protection

- Only `POST`.
- Event string 1–100 chars, no control chars.
- Properties plain object, not array.
- Total payload ≤ 32 KB, keys ≤ 100, depth ≤ 5, string values ≤ 4096, no prototype pollution.
- Same-origin `fetch` only; no CORS open.

Not a full rate limiter — sufficient for this public but low-abuse surface.

## Diagnostics

Safe logs only:

```text
[analytics] forwarded event=quiz_complete
[analytics] posthog forward failed status=502 event=quiz_complete
[analytics] not configured: POSTHOG_PROJECT_TOKEN missing …
```

Never logs `req.body` or full properties.

## Local verification

Without `POSTHOG_PROJECT_TOKEN` relay returns 503; app still starts (client swallows). For unit tests PostHog is mocked — no real token required.

To verify locally with a real project:

```text
POSTHOG_PROJECT_TOKEN=phc_… POSTHOG_HOST=https://us.i.posthog.com pnpm dev
# then in browser console: fetch('/api/analytics', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({event:'quiz_start', properties:{quiz_id:'music90s', platform:'browser', anonymous_id:'test', session_id:'test'}})})
# → 204 (or 502 if token/host wrong) and event appears in PostHog Live Events when 204
```

## Merge safety

This pass does not modify:

- `src/content/quizzes/music90s/quiz.ts`
- question bank / selector / result ranges / scoring (42 bank, 18/run, denominator 18 intact)
- result visuals / landing / share transport

A later merge will add `category`, `position`, `is_correct`, `run_id` to `question_answered` without backend schema migration — the relay already accepts arbitrary safe properties.
