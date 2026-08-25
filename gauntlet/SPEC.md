# Gauntlet SPEC — Telegram Interactive MVP

## Product

Telegram Mini App с одним personality-тестом **«Какой у тебя интерьерный характер?»**
и проверкой viral loop: `OPEN → START → COMPLETE → SHARE → NEW OPEN`.

## Approved content (LOCKED)

Источник истины по контенту — утверждённый product spec (аддендум):

- Result IDs: `quiet`, `paris`, `italian`, `collector`, `cottage`, `scandi`
- Q1–Q7: ровно 4 ответа; Q8: ровно 6 ответов → **4^7 × 6 = 98 304 комбинации**
- Веса: primary +2 / secondary +1 — зафиксированы тестом `tests/unit/content.test.ts`
- Tie-break: 5 стадий — max total → q8 control primary → primary-hit count →
  q1→q7→q5 primary order → fixed order (`quiet…scandi`)
- Content Integrity Rules: тексты/веса/ID не переписываются; расхождение = P1.
  Технические проблемы из-за copy фиксируются в отчёте, а не молча правятся.

## Scoring correctness

Источник истины — только automated verification:

- `pnpm test` → exhaustive validator: 98 304/98 304 resolve, 6/6 reachable,
  0 nondeterministic (см. `gauntlet/reports/content-validation.md`).
- Critic G02 НЕ оценивает «правильность» скоринга субъективно — только
  соответствие реализации spec + observable evidence из validation report.

## Telegram platform states

```text
telegram — реальный Mini App контейнер (initData валиден, identity настоящая)
mock     — явный детерминированный мок: dev environment, ?mock=1, Playwright
browser  — обычный web-fallback вне Telegram (без фейковой личности,
           initData пустой, share через graceful fallback)
```

Mock ≠ browser fallback. Production build никогда не превращает отсутствие
Telegram-контекста в фейкового Telegram-пользователя.

## Share security boundary

1. Клиент шлёт `resultId` + raw `initData`.
2. Сервер валидирует подпись и свежесть (@tma.js/init-data-node).
3. `user_id` берётся ТОЛЬКО из validated payload.
4. `resultId` проверяется по allowlist контента.
5. Image URL и deep link строятся сервером из env (`APP_BASE_URL`,
   `TELEGRAM_BOT_USERNAME`) — произвольные URL с клиента не принимаются.
6. `TELEGRAM_BOT_TOKEN` существует только server-side.
7. `share_success` эмитится только после подтверждённого Telegram event
   (`share_message_sent`); закрытие шторки без отправки = не успех.

## Visual direction

Premium editorial lifestyle: тёплый ivory фон, graphite текст, burgundy акцент,
display serif + sans-grotesk, радиусы 8–14px, photography-first, mobile-first,
min-width 360px. Запрещены: Telegram-blue generic, purple AI gradients,
glassmorphism, gaming UI, neon, dense dashboards.

До появления утверждённых `/references`: максимум 1 субъективный visual round;
hard UX проблемы исправляются всегда.

## Gauntlet tasks

G00 Foundation · G01 Telegram Shell · G02 Quiz Engine · G03 Quiz UX ·
G04 Result · G05 Share · G06 Analytics · G07 Integration.

Правила: MAX_ROUNDS=3 на задачу (до references); hard gates перед критиком
(lint/typecheck/tests/build/Playwright/console); plateau stop после 2 неудачных
фиксов одного P0/P1; spec-blocked stop при неоднозначных критериях.

## Definition of Done

См. `gauntlet/QUALITY_BAR.md`. Кратко: все гейты зелёные, 0 P0/P1,
6/6 результатов достижимы, mock mode работает, share endpoint защищён,
токен только на сервере, G07 integration critic PASS.
