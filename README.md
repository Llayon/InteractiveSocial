# Interactive Social — Telegram Mini App MVP

Telegram Mini App с personality-тестом **«Какой у тебя интерьерный характер?»**:
landing → 8 вопросов → детерминированный scoring → editorial result →
native Telegram share → restart.

Стек: Vite · React 19 · TypeScript · pnpm · Zod · @tma.js/sdk(-react) ·
Vitest · React Testing Library · Playwright · ESLint · Prettier ·
Vercel (+ Functions для защищённых Bot API вызовов).

## Локальная разработка

```bash
pnpm install
pnpm dev            # http://localhost:5173 — работает в браузере БЕЗ Telegram
```

В dev-режиме приложение использует явный **Telegram mock** (детерминированный,
никакой фейковой личности в production). Параметры:

```text
?mock=1                     форсировать mock в любом билде (staging/демо)
?startapp=share_quiet       симулировать start parameter (атрибуция)
?tgWebAppStartParam=...     то же самое, нативное имя параметра
?share=fail                 mock share завершается неудачей (тест fallback)
```

Состояния платформы (см. `src/platform/telegram`):

| Режим      | Когда | Поведение |
|------------|-------|-----------|
| `telegram` | production внутри Mini App | реальный WebApp bridge |
| `mock`     | dev / `?mock=1` / Playwright | детерминированный мок |
| `browser`  | production вне Telegram | web-fallback, без фейковой личности, share через fallback |

## Скрипты

```bash
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest: unit + integration + exhaustive scoring validation
pnpm build         # typecheck + production build
pnpm test:e2e      # Playwright (4 viewport'а: 360/390/430/1280)
pnpm share-cards   # регенерация placeholder PNG карточек результатов
```

## Environment variables

Server-only (Vercel Functions, НИКОГДА не попадают в клиентский бандл):

```text
TELEGRAM_BOT_TOKEN        токен бота для savePreparedInlineMessage
TELEGRAM_BOT_USERNAME     username бота (deep link t.me/<bot>/<app>)
TELEGRAM_APP_SHORT_NAME   short name Mini App в BotFather (по умолчанию app)
APP_BASE_URL              публичный origin деплоя (для share-картинок)
```

Client-side (public):

```text
VITE_ANALYTICS_PROVIDER=console   пока провайдер аналитики не подключён
```

Пример: `.env.example`.

## Тесты

- **Unit**: Zod-схема, content lock (все тексты/веса утверждённого спека),
  все 5 стадий tie-break, reducer (double-tap guard, back/change/restart),
  server-side initData validation (valid/tampered/expired/wrong-token fixtures).
- **Exhaustive**: полный перебор **98 304** комбинаций (4^7 × 6):
  все resolve детерминированно, 6/6 архетипов достижимы.
  Отчёт: `gauntlet/reports/content-validation.md`.
- **Integration**: полный flow через React Testing Library без браузера.
- **E2E (Playwright)**: journey landing→8→result→share→restart, back/change
  answer, mock mode, graceful share degradation, responsive quality bar на
  360×800 / 390×844 / 430×932 / 1280×800, hard gate на console.error /
  pageerror / unhandled rejection. Реальный Telegram runtime и CDN не нужны.

## Vercel deployment

1. Import repo в Vercel (framework: Vite, авто-детект).
2. Function `api/share/prepare` подхватится автоматически (`/api/*`).
3. Задать env из раздела выше (Production + Preview).
4. CI (`.github/workflows/ci.yml`) гейтит деплой: deploy-job выполняется
   только после lint/typecheck/tests/build/E2E. Секреты:
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Настройка Telegram Bot / Mini App

1. `@BotFather` → `/newbot` → получить `TELEGRAM_BOT_TOKEN`.
2. `/newapp` (или Bot Settings → Menu Button) → указать URL деплоя и
   short name → получится deep link `https://t.me/<bot>/<short_name>`.
3. Заполнить env на Vercel. Готово: Mini App открывается по deep link,
   share-сообщения возвращают `startapp=share_<resultId>`.

## Архитектура

```text
src/
├── app/               App shell, bootstrap, screens
├── features/
│   ├── landing/       вход viral loop
│   ├── quiz/          schema (Zod), scoring, reducer, UI — data-driven
│   ├── result/        editorial reveal + result card
│   └── share/         prepare → native shareMessage → graceful fallback
├── platform/telegram/ единственное место с Telegram-специфичным кодом
├── content/quizzes/   утверждённый контент как конфигурация (LOCKED)
├── analytics/         provider abstraction + дедупликация событий
├── design/            tokens + editorial стили
└── lib/
api/share/prepare.ts   Vercel Function: initData validation → prepared message
tests/                 unit / integration / e2e
gauntlet/              SPEC, QUALITY_BAR, отчёты по задачам G00–G07
```

Новый тест добавляется файлом в `content/quizzes/<id>/` + регистрацией в
`content/quizzes/index.ts` — движок и UI не меняются.

## Известные ограничения

- Share card'ы — placeholder-градиенты (стабильные ключи `result_<id>.png`,
  заменяются файлами без изменения кода).
- `web_app_share_message` — метод Bot API 9.x; @tma.js/bridge ещё не
  типизировал его (escape-hatch изолирован в `platform/telegram/real.ts`).
  Проверка реальной отправки возможна только после деплоя с реальным токеном.
- Аналитика — console-провайдер до подключения реального сервиса.
