# QUALITY BAR — измеримые критерии качества

## Hard gates (машинно проверяемые, перед каждым critic-раундом)

```text
pnpm lint        PASS
pnpm typecheck   PASS
pnpm test        PASS   (unit + integration + exhaustive scoring + new-mechanic tests)
pnpm build       PASS
Playwright E2E   PASS   (все viewport'ы: 360x800, 390x844, 430x932, 1280x800)
0 unexpected console.error
0 pageerror
0 unhandled promise rejection
```

## Multi-mechanic test matrix (added in K0–K5)

- Interior exhaustive 98,304 (archetype) — locked regression baseline.
- Music90s scoring: 0/2/3/5/7/10 → 5 correct bands (m90_rookie/familiar/
  cassette/disco/legend). Order-agnostic. Throws on out-of-range score.
- Schema/integrity: archetype, correct-count; namespaced and legacy
  result ids; duplicate answer ids across DIFFERENT questions supported;
  duplicate within SAME question rejected.
- Correct-count bands: 0..total covered; no gaps; no overlaps;
  inverted bands rejected; band referencing unknown result rejected.
- Music90s share-card asset (score_00..score_10): exists, 1080x1350.
- Cross-quiz wire v2: s2_m90_<code> routes Music90s; s2_ic_<code>
  still routes Interior; unknown codes fall back without blanking.
- Legacy v1 share_<result> still routes Interior.
- Server rejects impossible score/result band mismatch
  (status 400 invalid_score).

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

- Interior: 8/8 вопросов; Q1–Q7 = 4 ответа; Q8 = 6; веса/копия/ID LOCKED.
- 98 304/98 304 комбинаций resolve детерминированно (exhaustive).
- 6/6 архетипов достижимы, 0 dangling, каждый result referenced.
- Music90s: 10/10 вопросов; каждый `correctAnswerId` указывает на
  существующий answer; bands покрывают 0..10 без дыр/перекрытий.
- 5/5 bands достижимы; 5 semantic result ids, 11 score card variants.
- 0 P0/P1 в локальном critic любой milestone.

## Runtime quality

- Playwright failит на: pageerror, console.error, unhandled rejection.
- Исключения для сторонних библиотек документируются явно (сейчас: none).
- analytics failure никогда не ломает UX (provider изолирован try/catch).
- Share/deferred persistence failure не ломает UX (fire-and-forget).

## Security gates

- `TELEGRAM_BOT_TOKEN` отсутствует в client bundle (grep по dist обязателен).
- initData валидируется server-side (подпись + freshness) до любого
  Bot API вызова с user_id.
- user_id / result_id / score не доверяются без валидации.
- Для correct-count: score дополнительно проверяется на
  диапазон + соответствие band, но ОСТАЁТСЯ client-authoritative
  (playful MVP). NEVER trust для leaderboard/competition/rewards.
- share endpoint возвращает структурные ошибки, не утечки.
- canonical result-id grammar (^[a-z][a-z0-9_]{0,63}$) на API входе.

## Critic contract

```text
STATUS: PASS | FAIL
P0: app broken / security / data corruption
P1: core UX or requirement failure
P2: polish / minor usability
LARGEST_GAP: one specific highest-impact issue
EVIDENCE: observable evidence only
```

Milestone успешен при: all hard gates PASS, 0 P0, 0 P1. P2 может оставаться
при низком ROI. Critic не вознаграждает effort и не оценивает объём кода.

## Definition of Done (MVP)

Все hard gates зелёные одновременно + Interior 98,304 PASS + Music90s
scoring tests PASS + mock mode работает + production Telegram integration
реализована + share endpoint защищён + bot token server-only + 0 P0/0 P1
в локальном critic + production deployment достижим.