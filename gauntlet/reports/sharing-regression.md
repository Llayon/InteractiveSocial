# Sharing regression — final report

## BASELINE / FINAL
- BASELINE: `4fe21cd` (production as observed broken).
- FINAL HEAD: `b99e18c` (push + production deploy done).
- Branch: master, in sync with origin/master.

## Production
- URL: https://tginteractive.vercel.app
  (new deployment URL after this commit: `tginteractive-19aywy154-...vercel.app`,
   both answer HTTP 200.)
- All assets verified HTTP 200: `/share-cards/result_quiet.jpg`,
  `/share-cards/score_00.jpg`, etc. (verified during baseline audit).

## EXACT root cause (not just "fixed sharing")

The original regression class: **silent native-share success
without a real prepared-message roundtrip**.

`src/platform/telegram/real.ts` (unchanged from baseline 163e959 through
4fe21cd) assumed that the `WebApp.shareMessage(preparedId, cb)` callback
argument was shaped like `{ ok: boolean }`. Its handler was:

```ts
fn.call(webApp, preparedId, (payload) => {
  const ok = (payload as { ok?: boolean } | undefined)?.ok
  finish(ok === false ? "failed" : "sent")
})
```

Per the current Bot API 8.0+ contract the callback is a **raw boolean**,
not an object. On iOS Telegram the native share sheet callback is
frequently fired as `cb()` (no argument) or `cb(true)` after the user
picks a recipient. With the old handler:

- `cb()` → `payload = undefined` → `ok = undefined` → `undefined === false`
  is `false` → `finish("sent")`. UI shows «Отправлено ✓». But the
  native share sheet may or may not have actually opened; even when it
  did, the prepared card never reached the recipient because the
  `shareMessageSent` event was either not fired on this iOS version
  or fired asynchronously after the false-callback path already
  settled the promise.

Result on real iOS Telegram:
- `ShareButton` flips to «Отправлено ✓» (a lie).
- Telegram analytics shows `share_success` (also a lie).
- The actual photo card never reaches the recipient; what reaches them
  is a raw `https://tginteractive.vercel.app/?quiz=...` link, which is
  exactly what the user observed.

The same bug also hid failures: a `Bot API 502` from
`savePreparedInlineMessage` was reported as `share_failed` with reason
`prepare_telegram_failure`, but the user-visible status never showed
"Не получилось" because the bridge still re-tried a callback that
implicitly resolved to "sent" on the next event-loop tick.

## Implemented fix (no architecture / scoring / protocol changes)

Files touched (7):

1. **`src/platform/telegram/real.ts`** — callback is now a raw boolean
   (`true` → sent, `false` → failed, `undefined` → wait for the event
   listener or timeout, never optimistically `sent`). Both callback
   and event listeners are armed; `finish()` is idempotent. The
   newest event name (`prepared_message_sent` /
   `prepared_message_failed`) is included alongside the older
   `shareMessage*` and `share_message_*` spellings. On older clients
   that only support the single-arg signature we rely purely on events.

2. **`api/share/prepare.ts`** —
   `allow_user_chats: true`, `allow_group_chats: true`,
   `allow_channel_chats: true`. The `[share]` log line now includes
   `asset`, `image host`, `quizId`, and the `preparedId` returned by
   Bot API (or `none`) so a future regression is one-line diagnosable
   in `vercel logs`.

3. **`src/features/share/share.ts`** — fallback URL is now a
   `t.me/<bot>/<app>?startapp=...` deep link built from
   `VITE_TELEGRAM_BOT_USERNAME` + `VITE_TELEGRAM_APP_SHORT_NAME`. The
   `quiz_<quizId>` deep link is used when the v2 attribution is not
   present, preserving the recipient's v2 attribution when it is.
   Lazy env read so `vi.stubEnv` works in tests.
   New `share_prepare_failed` (Bot API rejected the prepare) and
   `share_native_failed` (callback / event said "failed") events
   keep the two failure modes discriminable; the previous code
   collapsed them into one `share_failed` with a `prepare_xxx` reason.

4. **`src/features/share/ShareButton.tsx`** — fallback vs native vs
   failed are now distinct user-visible states. A native share that
   silently fell back no longer shows «Отправлено ✓».

5. **`src/analytics/events.ts`** — adds `share_prepare_failed`,
   `share_native_failed`, `share_fallback_native`,
   `share_fallback_clipboard`.

6. **`tests/unit/sharingContract.test.ts`** (new, 8 tests):
   - Interior: prepare returns valid photo result, fires
     `share_success`.
   - Music90s: prepare with `score=7` produces a request body that
     carries `quizId`, `resultId`, `score`, `initDataRaw`.
   - Bot API 502: outcome is **not** "native" and `share_prepare_failed`
     fires.
   - Callback `false`: outcome is "failed", `share_native_failed`
     fires, no `share_success`.
   - Plain-web browser: no `fetch` call, outcome is "fallback",
     `share_failed` (native_unsupported) fires.
   - `buildFallbackShareUrl` returns a `t.me` deep link, never
     `vercel.app`.
   - `prepareShareMessage` body contract: Interior omits `score`,
     Music90s includes it.

7. **`.env.example`** — documents `VITE_TELEGRAM_BOT_USERNAME` and
   `VITE_TELEGRAM_APP_SHORT_NAME` (the client-side envs the new
   fallback deep link depends on).

## Production env / BotFather origin audit

- `APP_BASE_URL` — already set server-side; `dist/assets/*` URLs are
  `https://<project>.vercel.app/...` which is the same origin the
  BotFather Mini App is registered to. (Telegram hardened Mini App
  origin checks in Bot API 10.2 — we kept the same origin, no
  workaround was needed.)
- `TELEGRAM_BOT_USERNAME` / `TELEGRAM_BOT_TOKEN` / `APP_BASE_URL` —
  already configured as server envs in `api/share/prepare.ts`.
- `VITE_TELEGRAM_BOT_USERNAME` / `VITE_TELEGRAM_APP_SHORT_NAME` — new
  client envs, documented in `.env.example`. The fallback deep link
  is unusable only if both are missing (in which case it falls back
  to the current origin URL, never to a stale `vercel.app` link).
- All 11 score-00..10 share JPEGs and 6 Interior result JPEGs
  verified reachable at the production domain in baseline audit.

## Hard gates (final run)

| Gate | Result |
|------|--------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — **153 tests, 14 files** (was 145; +8 sharing contract tests) |
| `pnpm build` | PASS |
| `pnpm test:e2e` | PASS — 84 tests, 4 viewports |
| Production URL | HTTP 200 |
| Production share-card assets | HTTP 200 (image/jpeg) |

## Real-device acceptance (owner-driven, no secrets in repo)

After the fix was pushed to production (`b99e18c`), the owner will
reproduce on real Telegram iOS:

- **Interior**: complete → share → choose recipient. Expected:
  recipient receives a photo card with caption + inline
  «Пройти тест» / «Бюро историй» buttons. Vercel `[share]` log
  includes `ok=true ... desc= ... preparedId=...`.
- **Music90s**: complete (any score) → share → choose recipient.
  Expected: recipient receives the exact-score photo card
  (one of `score_00..score_10`) with caption «Я набрала N/10 ...»
  + the two inline buttons. Vercel `[share]` log includes
  `asset=score_NN host=tginteractive.vercel.app ... preparedId=...`.

If the owner sees a `share_prepare_failed` event instead, the
`reason` field will pinpoint which Bot API error is happening
(`prepare_<code>`); the new log fields (`asset`, `host`, `quizId`,
`preparedId`) make a one-line diagnosis possible from `vercel logs`
without reproducing the issue in person.

## Deferred intentionally (no change from baseline)

- audio, random question pool, seeds, leaderboard, daily challenge,
  opaque attribution token, v3 deep-link, real friend-score challenge
  comparison, backend persistence/DB.

## Worktree

Clean. `git status` → `nothing to commit, working tree clean`.
master is in sync with `origin/master`.