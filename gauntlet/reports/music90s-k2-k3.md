# K2 + K3 — Correct-count scoring + Music90s content

## Scope
- K2: correct-count scoring mechanic, answer behavior discrimination,
  band integrity, server-side score validation.
- K3: 10-question Music90s quiz, deterministic feedback UX, exact-score
  share-card generator, mobile-readable visual direction.

## New content (`src/content/quizzes/music90s/`)

10 fixed questions, 5 categories, 3 difficulty levels, 4 options each.
No randomization, no audio, no lyrics, no album art — all copy is
original; song titles/artist names/release years are factual.

| # | category | difficulty | question | correct |
|---|----------|-----------|----------|---------|
| m1 | emoji | easy | ☁️ → «Тучи» | c |
| m2 | emoji | medium | 💿 + 📼 → cassette/CD | a |
| m3 | artist | easy | «Крошка моя» — artist? | b |
| m4 | artist | medium | «Тучи» — artist? | c |
| m5 | timeline | medium | earliest of 1995/1996/1999/1996 | a (Иванушки 1995) |
| m6 | timeline | hard | earliest of 1998/1997/1999/1999 | b («Тучи» 1997) |
| m7 | title | medium | Земфира 1999, «Я …» | d («Я сошла с ума») |
| m8 | title | easy | «Тополиный пух, жара, июль» | a |
| m9 | absurd | hard | подъезд вставал, гравитация для рук необязательна | c (Руки Вверх!) |
| m10 | absurd | hard | тоска тверского двора, маршрутки | b («Владимирский централ») |

Band distribution (5 semantic results, NOT one per score):

| Score | Result id | Band title |
|-------|-----------|-----------|
| 0–2 | m90_rookie | Ты случайно зашла в 90-е |
| 3–4 | m90_familiar | Ты где-то это слышала |
| 5–6 | m90_cassette | Кассетный человек |
| 7–8 | m90_disco | Дискотека 1999 |
| 9–10 | m90_legend | Легенда кассетного века |

## Generic answer behavior

- `answerBehavior.mode === 'instant'`: identity unchanged (Interior).
- `answerBehavior.mode === 'feedback'` with `durationMs`: generic UI
  barrier. `QuizQuestion` renders ✓/✕ + the correct answer when wrong.
  `Quiz.tsx` owns a single imperative `setTimeout` whose ref-based
  cleanup is well documented in `eslint.config.js`.
- Quiz-owned copy (`correctMessage`, `wrongMessage`) lives in the
  `feedback` variant of the discriminated union; the runtime never
  hard-codes music-specific strings.

## Correct-count scoring mechanic

- `scoring.kind === 'correct-count'`, with `bands: { min, max, resultId }[]`.
- `loadQuiz` validates: bands start at 0, cover up to `total`, no gaps,
  no overlaps, every `resultId` registered, every question has a
  `correctAnswerId` that points to one of its answers.
- `computeCorrectCount(quiz, answers)` is order-agnostic: walks every
  `quiz.questions` entry and counts `selected.answerId === correctAnswerId`.
- `resolveBandResultId(quiz, score)` is fail-fast; `resolveOutcome`
  dispatches on `scoring.kind` to the right branch.

## Deterministic exact-score share cards

`scripts/generate-score-cards.ps1` produces 11 source masters in
`assets-source/score-cards/score_XX.png` (1080x1350). The existing
`scripts/optimize-share-cards.ps1` and `pnpm images:runtime` pipelines
have been extended to derive production assets from these masters
(22 share JPEGs + 33 runtime variants per score = 75 variants). Card
identity on the result screen is selected by the resolved score
(`scoreCardAsset(score)`); card identity in the share/deliver API is
server-computed, never a client-supplied URL.

## Hard gates

| Gate | Result |
|------|--------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 139 tests, 12 files |
| `pnpm build` | PASS |
| `pnpm images:runtime` | PASS (75 variants, budget PASS) |
| `pnpm test:e2e` | PASS — 84 tests, all 4 viewports |
| Interior 98,304 exhaustive | PASS (regression baseline preserved) |

## Architecture grep

```
grep -r "music90s" src/features src/app api/_lib                -> 0 hits
grep -r "m90_"   src/features src/app api/_lib                   -> 0 hits
grep -r "music90s" src/content/quizzes/music90s scripts          -> present
grep -r "m90_"   src/content/quizzes/music90s scripts            -> present
```

All Music90s-specific knowledge is contained in:
- `src/content/quizzes/music90s/`
- `src/content/quizzes/codes.ts` (wire codes)
- `scripts/generate-score-cards.ps1` (master generator)
- `tests/e2e/music90s*.spec.ts` (journey E2E)
- `tests/unit/music90s.test.ts` (scoring E2E)
