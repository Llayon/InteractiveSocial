# Interactive Social — Telegram / MAX Mini App

Universal Mini App platform for interactive social quizzes running in Telegram, MAX and browser fallback.

Current production quizzes include the interior personality quiz, the Music90s nostalgia quiz and Guess90s. The shared runtime owns routing, scoring, result delivery, share transport and analytics; quiz-specific behavior belongs in declarative quiz config rather than `if (quiz.id === ...)` branches.

Stack: Vite · React 19 · TypeScript · pnpm · Zod · @tma.js/sdk(-react) · Vitest · React Testing Library · Playwright · ESLint · Prettier · Vercel Functions.

## Local development

```bash
pnpm install
pnpm dev
```

Useful mock/query modes:

```text
?mock=1                         deterministic mock
?mock=1&platform=max            MAX mock
?quiz=music90s                  direct browser quiz routing
?startapp=s2_m90_cs_123456      challenge attribution fixture
```

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm images:runtime
```

## Environment variables

Server-only Vercel Function env:

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_APP_SHORT_NAME=app
APP_BASE_URL=https://tginteractive.vercel.app

MAX_BOT_TOKEN=
MAX_BOT_USERNAME=se14154487_bot
MAX_EXTRA_CA_PEM=
# optional alternative when the file definitely exists at process start:
MAX_EXTRA_CA_PATH=
```

Client-side public env:

```text
VITE_ANALYTICS_PROVIDER=console
VITE_TELEGRAM_BOT_USERNAME=...
VITE_TELEGRAM_APP_SHORT_NAME=app
VITE_MAX_BOT_USERNAME=se14154487_bot
```

See `.env.example` and `docs/max-setup.md` for the complete MAX production runbook.

## Platform share / delivery

Telegram:

```text
/api/share/prepare
→ Telegram prepared inline message
→ WebApp.shareMessage(id)

/api/results/deliver
→ own result card
→ optional sharer notification
```

MAX:

```text
/api/max/share/prepare
→ shared MAX media helper
→ image upload/token
→ POST /messages
→ body.mid
→ WebApp.shareMaxContent({ mid, chatType: 'DIALOG' })

/api/max/results/deliver
→ same MAX media helper
→ own result card
→ optional sharer notification
```

The same media transport must be used for MAX challenge shares and result delivery. A regression affecting both usually points to the common MAX API/TLS/media layer rather than quiz UI or deep links.

### MAX production note

`platform-api2.max.ru` may require the Russian Trusted CA chain in Vercel. The production client uses a scoped `undici.Agent` with `MAX_EXTRA_CA_PEM` / `MAX_EXTRA_CA_PATH` and never disables TLS verification globally.

Do not rely on a `NODE_EXTRA_CA_CERTS` path that is created after Node process startup. This caused a production incident where `/me`, `/uploads` and `/messages` all failed with `unable to get local issuer certificate`; share degraded to plain text/link and bot result delivery returned `deliveredSelf:false`.

Detailed incident notes, diagnostics and recovery steps: `docs/max-setup.md`.

## Share-card assets

Correct-count quizzes use quiz-scoped exact-score assets. Music90s currently uses versioned share-card paths, e.g.:

```text
/share-cards/v2/m90_score_10.jpg
```

`APP_BASE_URL` must point at the stable public alias that actually serves those files with `200` and the correct image MIME type.

## Attribution

Challenge deep links use the generic v2 wire format:

```text
s2_<quizCode>_<resultCode>_<uid>
```

Telegram and MAX share the same logical attribution format while keeping delivery platform-scoped.

## Architecture

```text
src/
├── app/
├── features/
│   ├── landing/
│   ├── quiz/
│   ├── result/
│   └── share/
├── platform/
│   ├── telegram/
│   └── max/
├── content/quizzes/
├── analytics/
├── design/
└── lib/

api/
├── share/prepare.ts
├── results/deliver.ts
├── max/share/prepare.ts
├── max/results/deliver.ts
└── _lib/
    ├── maxApi.ts
    └── maxMedia.ts
```

## Adding a new quiz

1. Add `src/content/quizzes/<id>/quiz.ts` and results/config.
2. Register it in `content/quizzes/index.ts`.
3. Add v2 wire codes in `content/quizzes/codes.ts`.
4. Reuse generic scoring/share/delivery/runtime.
5. Add/optimize assets and regression coverage.

Avoid quiz-id branching in shared runtime when the behavior can be represented by mechanics or config.

## Production QA

Before declaring Telegram/MAX share work complete, verify on real clients rather than relying only on mocks.

Minimum MAX smoke test:

```text
complete quiz
→ own bot result card arrives

press Бросить вызов
→ recipient picker opens
→ recipient receives visual card, not only text/link
```

For attribution QA, use two real accounts when practical:

```text
A shares
→ B opens challenge
→ B completes
→ B receives own result
→ A receives sharer notification
```

## Deployment

Vercel deploys from `master`. After changes:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then verify the production deployment status and run real platform smoke tests for any share/delivery transport changes.
