# Analytics — Production Relay

## Overview

```
Mini App → src/analytics/httpProvider.ts → POST /api/analytics → PostHog Capture API
```

- Client never calls PostHog directly.
- Same-origin `POST /api/analytics` only.
- Fire-and-forget: `fetch(..., { keepalive: true })`, analytics failure never blocks UX.
- Privacy: no Telegram/MAX user ids, no names, no tokens.

## Environment

Server-only (Vercel Functions, never `VITE_`):

```text
POSTHOG_API_KEY=               # PostHog project write key (required)
POSTHOG_HOST=https://us.i.posthog.com  # optional — defaults to US Cloud
```

- `POSTHOG_API_KEY` must be set in Vercel Production/Preview; if missing, the relay logs a warning and still returns 204 so client UX is unaffected (event is dropped).
- `POSTHOG_HOST` defaults to `https://us.i.posthog.com` when unset. For EU Cloud use `https://eu.i.posthog.com`.
- Never prefix with `VITE_` — the key must not enter the client bundle.

Client (optional override):

```text
VITE_ANALYTICS_PROVIDER=console|http  # dev only
# prod always uses http regardless of this var
# dev default: composite (http + console) for visibility
# test default: console (injected mock)
```

## Anonymous identity

- `anonymous_id` — per-browser install id. Generated via `crypto.randomUUID()`, persisted in `localStorage` at `interactive_social_analytics_id`. If storage is unavailable, an ephemeral per-page id is used. No Telegram/MAX identifier.
- `session_id` — per app open. Generated via `crypto.randomUUID()` at bootstrap, ephemeral (not persisted). All events in one Mini App open share the same `session_id`.
- `run_id` — per quiz run. Not implemented in this pass; the backend accepts it as an arbitrary safe property so a later merge can add it without migration.

All three are attached via `baseContext` in `bootstrap()` so every `getAnalytics().track(...)` automatically includes them.

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

relay converts to PostHog:

```json
{
  "api_key": "<POSTHOG_API_KEY>",
  "event": "quiz_start",
  "distinct_id": "<anonymous_id>",
  "properties": {
    "quiz_id": "music90s",
    "platform": "max",
    "$ip": null,
    "$geoip_disable": true
  }
}
```

`$ip: null` ensures the Vercel server IP is not stored as the user IP. Project-level "Discard client IP data" should also be enabled in PostHog for GDPR compliance.

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
- `properties` — optional plain object (not array), ≤ 32 KB total payload, ≤ 100 keys, depth ≤ 5.
- Forbidden keys (`telegram_user_id`, `username`, `initData`, `token`, `chat_id`, `question_text`, etc.) are stripped before forwarding.

Responses:

- `204` — accepted (forwarded or intentionally dropped when not configured). Never returns PostHog raw response.
- `400` — malformed input, empty event, array properties, etc.
- `405` — non-POST method.
- `413` — payload too large.

Upstream PostHog failures are logged server-side (`[analytics] forward failed …`) but still return `204` to the client.

## Validation / Abuse protection

- Only `POST`.
- Event must be string 1–100 chars.
- Properties must be plain object.
- Total payload ≤ 32 KB.
- Keys ≤ 100, depth ≤ 5, string values ≤ 4096.
- No array root, no control characters in event name.
- Same-origin `fetch` only; no CORS open.

Not a full rate limiter — sufficient for this public but low-abuse surface.

## Diagnostics

Safe logs only:

```text
[analytics] forwarded event=quiz_complete
[analytics] posthog forward failed status=…
[analytics] not configured: POSTHOG_API_KEY missing …
```

Never logs `req.body`.

## Local verification

Without `POSTHOG_API_KEY` the app still starts; events are dropped with a warning and 204. For unit tests, PostHog is mocked — no real key required.

To verify locally with a real project:

```text
POSTHOG_API_KEY=phc_… POSTHOG_HOST=https://us.i.posthog.com pnpm dev
# then in browser console: fetch('/api/analytics', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({event:'quiz_start', properties:{quiz_id:'music90s', platform:'browser', anonymous_id:'test', session_id:'test'}})})
# → 204 and event appears in PostHog Live Events
```

## Merge safety

This pass does not modify:

- `src/content/quizzes/music90s/quiz.ts`
- question bank / selector / result ranges / scoring
- result visuals / landing / share transport

A later merge will add `category`, `position`, `is_correct`, `run_id` to `question_answered` without backend schema migration — the relay already accepts arbitrary safe properties.
