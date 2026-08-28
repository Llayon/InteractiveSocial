# Music90s — Final report

## BASELINE → FINAL
- BASELINE SHA: `163e9591991ece1c1b9d6a503043d078c8b0d9b8`
- FINAL HEAD:  `0e260f5` (docs), preceded by `c279b95` (K2+K3) and `4d0ce2c` (K0+K1).
- Branch: `master`, in sync with `origin/master` (verified by `git status`).

## Production
- URL: https://tginteractive-j4sbnos7h-maximocappuccino-gmailcoms-projects.vercel.app
  - GET `/` → HTTP 200, ~342 KB SPA HTML.
  - GET `/share-cards/score_00.jpg` → 200 (asset bundled in `dist/`).
  - GET `/share-cards/score_10.jpg` → 200.
  - GET `/share-cards/result_quiet.jpg` → 200.
  - GET `/optimized/manifest.json` → 200.
- Deploy authority: local Vercel CLI (`vercel deploy --prod --yes`),
  after local hard gates green. No CI race.

## Commits
- `4d0ce2c` refactor(quiz): generic scoring outcomes + Music90s wire codes
- `c279b95` feat(quiz): add correct-count scoring + Music90s product
- `0e260f5` docs: update gauntlet SPEC/QUALITY_BAR for two-quiz generic platform

## Implemented
- **K0** Generic scoring outcomes (`QuizOutcome` discriminated union),
  `resolveOutcome` dispatcher on `scoring.kind`.
  `presentation.kind` ∈ {personality, score}.
  `answerBehavior.mode` ∈ {instant, feedback}.
  Compound `(questionId, answerId)` identity (no global answer id).
  App runtime never reads `answer.scores`; the scoring module owns
  archetype internals via `questionAnsweredTelemetry` /
  `quizCompleteTelemetry`.
- **K1** Global result-id grammar `^[a-z][a-z0-9_]{0,63}$` enforced
  at schema + registry + API input. Music90s wire codes (`m90`,
  `rk/fm/cs/dc/lg`). Server-computed image URL on share/deliver.
  Deliver dedup key `userId + quizId + resultId`. Quiz-aware copy
  (eyebrow, shareHeadline, deliverOwnLine) lives on the quiz.
- **K2** `correct-count` scoring: band validator (start at 0, cover
  up to `total`, no gaps, no overlaps, every band → known result).
  Per-question `correctAnswerId` validated.
  Server endpoints reject impossible score/result pairs
  (`invalid_score`, 400). Generic feedback barrier (~900ms) with
  ✓/✕ marks. Quiz-owned feedback copy in `answerBehavior` config.
- **K3** Music90s content: 10 fixed questions, 2 each of emoji /
  artist / timeline / title / absurd-description. 3 easy / 4 medium /
  3 hard. 4 options each. No lyrics, no audio, no album art.
  Five semantic bands with playful copy.
- **K4** Exact-score UI (`7 / 10` next to band title). 11
  deterministic 1080x1350 share cards (score_00..score_10) generated
  by `scripts/generate-score-cards.ps1` from one template, then run
  through the existing `optimize-share-cards.ps1` and
  `pnpm images:runtime` pipelines. Card identity is server-computed
  via `resolveShareCardAsset(quiz, result, score)`. v2 deep link
  unchanged (`s2_m90_<band>_<uid>`). SECURITY: client-authoritative
  score, never for leaderboard / competition / rewards.
- **K5** Analytics: `question_answered` carries `is_correct +
  category + position` for correct-count, `primary_result +
  secondary_result` for archetype. `quiz_complete` carries
  `result_id + score + total` for correct-count,
  `result_id + total_scores` for archetype. All events carry
  `quiz_id`. 139 unit/integration + 84 Playwright tests across 4
  viewports.

## Architecture proof

A future archetype quiz (e.g. «Какой город тебе подходит?») needs
ONLY data + assets — zero runtime changes:
- `src/content/quizzes/<id>/` (quiz.ts + results.ts) validated at
  load (archetype + personality + instant).
- Wire-code entry in `src/content/quizzes/codes.ts`.
- Hero / share-card assets produced by the existing pipeline.
- Registration in `src/content/quizzes/index.ts`.

A future correct-count quiz (e.g. «Угадаешь фильмы 2000-х?»)
needs the same — schema, codes, assets, registration. The runtime
already supports both mechanics with no changes.

`grep -r "music90s\|m90_" src/features src/app api/_lib` returns 0
hits — Music90s knowledge is contained in `src/content/quizzes/music90s/`,
the wire-code registry, the score-card generator, and tests.

## Music90s content

10 questions (m1..m10). Category / difficulty / correct:

| # | category | diff | correct |
|---|----------|------|---------|
| m1 | emoji | easy | c («Тучи») |
| m2 | emoji | medium | a (кассета и CD) |
| m3 | artist | easy | b (Руки Вверх!) |
| m4 | artist | medium | c (Иванушки International) |
| m5 | timeline | medium | a (Иванушки 1995) |
| m6 | timeline | hard | b («Тучи» 1997) |
| m7 | title | medium | d (Земфира «Я сошла с ума») |
| m8 | title | easy | a («Тополиный пух») |
| m9 | absurd | hard | c (Руки Вверх!) |
| m10 | absurd | hard | b («Владимирский централ») |

Five score bands: 0–2 m90_rookie · 3–4 m90_familiar · 5–6 m90_cassette ·
7–8 m90_disco · 9–10 m90_legend.

## Validation (deterministic)

| Gate | Result |
|------|--------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 139 tests, 12 files |
| `pnpm build` | PASS |
| `pnpm images:runtime` | PASS — 75 variants, budget PASS |
| `pnpm test:e2e` | PASS — 84 tests, 4 viewports (360x800, 390x844, 430x932, 1280x800) |
| Interior exhaustive 98,304 | PASS (regression baseline preserved) |
| Music90s scoring tests | PASS — 0..10 → correct band, throw on out-of-range, order-agnostic |
| Music90s card E2E | PASS — score_XX asset 1080x1350 served, thumbnail > 1 KB |
| Cross-quiz v2 deeplink E2E | PASS — s2_m90 routes Music90s, s2_ic still routes Interior, fallback safe |
| Legacy v1 E2E | PASS — `share_<result>-<uid>` still routes Interior |
| Server score-mismatch | PASS — `invalid_score` 400 on impossible score/band pair |
| Production URL | HTTP 200 (root + all share-card assets + manifest) |

## Gauntlet

- External critic calls used: **0** (OpenRouter not invoked; local
  critic is authoritative per the cost-aware gauntlet contract).
- External critic failures / quota exhaustion: N/A.
- Local critic final (each milestone):
  - **K0+K1**: STATUS PASS, P0 0, P1 0, P2 0, LARGEST_GAP none.
  - **K2+K3**: STATUS PASS, P0 0, P1 0, P2 0, LARGEST_GAP none.
  - **K4+K5**: STATUS PASS, P0 0, P1 0, P2 0, LARGEST_GAP none.

## Share

- 11 share cards generated (score_00..score_10), each 1080x1350 JPEG
  (44–50 KB) + thumbnail (256x320, 7–8 KB).
- 75 runtime variants (webp+jpeg × 480/720/960) for the result screen.
- Exact-score behaviour: card asset `score_XX` derived from the raw
  correct count; `result.score` is rendered next to the band title.
- v2 deeplink: `s2_m90_<band>_<uid>` opens Music90s, never Interior.
- Legacy regression: `share_<result>-<uid>` still routes Interior.
- Attribution safety: cross-quiz v2 attribution is detected and the
  sharer notification is suppressed.

## Deferred intentionally

- audio
- random question pool
- question seeds
- real friend-score challenge comparison
- backend persistence / database
- leaderboard
- daily challenge
- opaque attribution token (v3 protocol)
- v3 deeplink

## Worktree

Clean. `git status` reports `nothing to commit, working tree clean`
and `Your branch is up to date with 'origin/master'`.