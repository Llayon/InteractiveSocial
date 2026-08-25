# QUALITY BAR — измеримые критерии качества

## Hard gates (машинно проверяемые, перед каждым critic-раундом)

```text
pnpm lint        PASS
pnpm typecheck   PASS
pnpm test        PASS   (unit + integration + exhaustive scoring)
pnpm build       PASS
Playwright E2E   PASS   (все viewport'ы)
0 unexpected console.error
0 pageerror
0 unhandled promise rejection
```

## Responsive matrix

| Viewport | Статус |
|----------|--------|
| 360×800  | обязателен PASS |
| 390×844  | обязателен PASS |
| 430×932  | обязателен PASS |
| 1280×800 | обязателен PASS |

Требования на каждом экране (landing / все вопросы / result):

- zero horizontal page overflow (`scrollWidth <= innerWidth`)
- CTA не обрезан и кликабелен (bbox внутри вьюпорта)
- touch targets ≥ 40px высотой
- нет перекрытия essential UI
- нет контента, скрытого за Telegram-safe-area допущениями

## Content & scoring gates

- 8/8 вопросов; Q1–Q7 = 4 ответа; Q8 = 6 ответов
- веса ответов полностью совпадают с утверждёнными (content lock тест)
- 98 304/98 304 комбинаций resolve детерминированно
- 6/6 архетипов достижимы
- 0 dangling result IDs; все defined IDs referenced
- каждая стадия tie-break покрыта отдельным unit-тестом
- отчёт: `gauntlet/reports/content-validation.md` (распределение — diagnostic only)

## Runtime quality

- Playwright failит на: pageerror, console.error, unhandled rejection
- исключения для сторонних библиотек документируются явно (сейчас: none)
- analytics failure никогда не ломает UX (provider изолирован try/catch)

## Security gates

- `TELEGRAM_BOT_TOKEN` отсутствует в client bundle (grep по dist обязателен)
- initData валидируется server-side (подпись + freshness) до любого
  Bot API вызова с user_id
- user_id / result_id / start_param не доверяются без валидации
- share endpoint возвращает структурные ошибки, не утечки

## Critic contract

```text
STATUS: PASS | FAIL
P0: app broken / security / data corruption
P1: core UX or requirement failure
P2: polish / minor usability
LARGEST_GAP: one specific highest-impact issue
EVIDENCE: observable evidence only
```

Task успешна при: all hard gates PASS, 0 P0, 0 P1. P2 может оставаться при
низком ROI. Критик не вознаграждает effort и не оценивает объём кода.

## Definition of Done (MVP)

Все hard gates зелёные одновременно + mock mode работает + production
Telegram integration реализована + share endpoint защищён + bot token
server-only + 0 P0/0 P1 + G07 integration critic PASS.
