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
pnpm images:runtime # WebP/JPEG 480/720/960 для рантайма + manifest + budget guard
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
4. CI (`.github/workflows/ci.yml`) — quality-gate на пуши в `master` и на PR
   (lint / typecheck / tests / build / E2E). Production деплой — **локальный
   CLI после зелёного CI**: `vercel deploy --prod --yes` (единственный
   source of truth, чтобы CLI и Actions не катили друг друга). Миграция
   деплоя в CI — отложенное решение.

## Настройка Telegram Bot / Mini App

1. `@BotFather` → `/newbot` → получить `TELEGRAM_BOT_TOKEN`.
2. `/newapp` (или Bot Settings → Menu Button) → указать URL деплоя и
   short name → получится deep link `https://t.me/<bot>/<short_name>`.
3. Заполнить env на Vercel. Готово: Mini App открывается по deep link.
   Share-сообщения возвращают v2-параметр атрибуции
   `startapp=s2_<quizCode>_<resultCode>_<uid>`; legacy-формат
   `share_<resultId>-<uid>` (и исторический точечный) разбирается бессрочно.

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
api/results/deliver.ts Vercel Function: карточка автору + уведомление шарившему
api/_lib/              initData / attribution (v2+v1) / quizRequest хелперы
tests/                 unit / integration / e2e
gauntlet/              SPEC, QUALITY_BAR, отчёты по задачам G00–G07
```

## Добавление нового теста

1. `src/content/quizzes/<id>/` — `quiz.ts` + `results.ts` (schema-valid).
2. Регистрация в `content/quizzes/index.ts`.
3. Wire-коды v2 в `content/quizzes/codes.ts` (quizCode + resultCode на
   каждый результат; модуль fail-fast на дублях и дырах покрытия).
4. Всё остальное уже quiz-aware: App резолвит через
   `resolveQuizFromLaunch` (`?quiz=<id>` в браузере, `quiz_<id>` в
   startapp), API принимают `quizId` в теле и проверяют принадлежность
   результата квизу, share/deliver строят v2-ссылки автоматически,
   аналитика уже несёт `quiz_id`.
5. Ассеты: исходники в `assets-source/` → `pnpm images:runtime`
   (рантайм WebP/JPEG + manifest), share-открытки —
   `scripts/optimize-share-cards.ps1` → `public/share-cards` (JPEG
   1080×1350, REQUIRED thumbnail).

Движок, UI и share-пайплайн не меняются.

## Известные ограничения

- Share-открытки — реальные арты 1080×1350 JPEG в `public/share-cards`
  (перегенерация из `assets-source` через `optimize-share-cards.ps1`);
  рантайм-изображения — WebP/JPEG 480/720/960 в `public/optimized`
  (`pnpm images:runtime`, typed manifest, встроенный guard бюджета,
  network-contract E2E в `tests/e2e/network-scope.spec.ts`).
- Share-протокол v2 несёт числовой Telegram id шарившего в открытом виде
  (виден получателю ссылки, не секрет). Opaque attribution-токен требует
  серверного storage — deferred.
- `web_app_share_message` / callback `shareMessage(id, cb)` — Bot API 8+;
  типизация частично через escape-hatch (изолирован в
  `platform/telegram/real.ts`, callback-first + события как fallback).
- Аналитика — console-провайдер до подключения реального сервиса.
