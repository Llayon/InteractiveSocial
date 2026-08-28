# K0 + K1 — Core generalisation + platform cleanup

## Scope
- K0: introduce generic scoring outcomes; remove archetype knowledge from
  the generic App runtime.
- K1: quiz-aware copy, globally unique result ids, wire-code registry
  covers both Interior and (registered) Music90s.

## Architecture changes

- `src/features/quiz/schema.ts` (rewritten): canonical result-id grammar
  `^[a-z][a-z0-9_]{0,63}$`, presentation discriminated union
  (`personality` | `score`), answerBehavior discriminated union
  (`instant` | `feedback`), scoringConfig discriminated union
  (`archetype` | `correct-count`), cross-quiz uniqueness validation.
- `src/features/quiz/scoring.ts` (rewritten): `QuizOutcome` is the
  canonical boundary. Dispatch is on `scoring.kind`, never on
  `quiz.id`. Answers are looked up via the compound
  `(questionId, answerId)` key.
- `src/features/result/Result.tsx` / `ResultCard.tsx`:
  presentation-aware — personality keeps the approved editorial reveal;
  score renders band title + exact score `7/10` and selects
  `score_XX` hero asset.
- `src/features/quiz/Quiz.tsx`: generic answerBehavior barrier. The
  reducer is untouched — the advance is still the same single
  `answer` action, so the locked double-tap guard still applies.
- `src/app/App.tsx`: never reads `answer.scores`; calls
  `questionAnsweredTelemetry(quiz, ...)` and `quizCompleteTelemetry`
  which own the archetype / correct-count branching internally.
- `src/content/quizzes/{index,codes}.ts`: global registry invariants
  + extended wire codes for `music90s → m90` and five band codes.
- `api/share/prepare.ts` + `api/results/deliver.ts`: canonical result-id
  grammar on input; correct-count server-side validation of
  `score ∈ [0..total]` AND `resolveBandResultId(quiz, score) === result.id`.
  Card asset is server-computed (`score_XX` for correct-count, no
  client-supplied URL). `deliver` dedup key now `userId + quizId + resultId`.

## Hard gates

| Gate | Result |
|------|--------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 97 tests, 11 files |
| `pnpm build` | PASS |
| Interior exhaustive 98,304 | PASS (regression baseline preserved) |

## Architecture grep

Searched for forbidden patterns in shared runtime:

```
grep -r "music90s" src/features src/app api/_lib    -> 0 hits
grep -r "m90_"   src/features src/app               -> 0 hits
grep -r "quiz.id ===" src/features src/app          -> 0 hits
```

All Music90s knowledge is isolated to `src/content/quizzes/music90s/`,
the wire-code registry, and the score-card generator. Scoring,
presentation, and answer-behavior dispatch go through the discriminator
configs (`scoring.kind`, `presentation.kind`, `answerBehavior.mode`).
