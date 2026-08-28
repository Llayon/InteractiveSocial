# Music90s — Final report (revised after factual-content pass)

## BASELINE → FINAL
- BASELINE SHA: `163e9591991ece1c1b9d6a503043d078c8b0d9b8`
- FINAL HEAD:  `3162c2a` (this commit), preceded by `201c641`,
  `0e260f5`, `c279b95`, `4d0ce2c`.
- Branch: `master`, in sync with `origin/master`.

## Production
- URL: https://tginteractive-j4sbnos7h-maximocappuccino-gmailcoms-projects.vercel.app
  - GET `/` → HTTP 200.
  - GET `/share-cards/score_00.jpg` etc. → 200 (asset bundled in `dist/`).
  - GET `/optimized/manifest.json` → 200.

## Commits in this expansion
- `4d0ce2c` refactor(quiz): generic scoring outcomes + Music90s wire codes
- `c279b95` feat(quiz): add correct-count scoring + Music90s product
- `0e260f5` docs: update gauntlet SPEC/QUALITY_BAR for two-quiz generic platform
- `201c641` docs: music90s final gauntlet report
- `3162c2a` fix(music90s): factual content audit + provenance gate + archetype hardening

## Post-review corrections (P1 fixes)

The first ship of Music90s had factual errors in three timeline/title
questions and one lyric-clue violation in `m8`. These were caught in
human review of the deployed content, not by the local Gauntlet
(which only proves structural correctness). The fact-correcting pass
is committed in `3162c2a`:

| # | Before | After (verified) |
|---|--------|-------------------|
| m5 | «Иванушки 1995» was the correct answer | **«Дискотека Авария — 1990»** is the correct answer (Wikipedia: «Musical groups established in 1990»). Иванушки 1995 / Руки Вверх! 1996 / Отпетые мошенники 1996 are all younger. |
| m6 | «Тучи — 1997», distractor «Я сошла с ума — 1999» | **«Тучи — 1996»** (Wikipedia: debut single from 1996 album «Конечно он»). Removed «Я сошла с ума» (it is t.A.T.u., 2000/2002). Replaced with **«Ариведерчи — 1999»** (Земфира single, 8 March 1999). 1996 < 1998 < 1999 = 1999 — order holds. |
| m7 | Fake Zemfira «Я сошла с ума» | **«Ариведерчи»** is on the 1999 debut album (track 12 per Wikipedia). Distractors «Хочешь», «Искала», «Не отпускай» are not on the debut. |
| m8 | lyric clue «Тополиный пух, жара, июль» | Factual album prompt: «Иванушки International, 1999. Песня с альбома "Об этом я буду кричать всю ночь"?» → «Тополиный пух». No lyric fragment in the title. |
| m9 | pun-based prompt («гравитация для рук необязательна») | Album prompt: «Иванушки International, 1996. Их дебютный альбом — это …» → «Конечно он». |
| m10 | lyric-clue prompt about «Владимирский централ» | Artist question: «Кто исполнил "Владимирский централ"?» → Михаил Круг. |
| m2 | «Без чего 90-е просто не существовали» (hyperbole, subjective) | «Главные носители музыки 90-х — это …» → «Кассета и CD». |

## Implemented
- **K0** Generic scoring outcomes (`QuizOutcome` discriminated union).
  Dispatch on `scoring.kind`. Compound (questionId, answerId) identity.
- **K1** Global result-id grammar `^[a-z][a-z0-9_]{0,63}$` enforced at
  schema + registry + API input. Wire codes for Music90s (`m90`).
  Server-computed image URL on share/deliver.
- **K2** `correct-count` scoring with band validator. Server
  validates `score ∈ [0..total] AND resolveBandResultId(quiz, score) === resultId`.
- **K3** Music90s content (10 fixed questions, 5 categories, 3 difficulty).
  **Factual content was re-verified against Wikipedia in commit `3162c2a`.**
- **K4** 11 deterministic 1080x1350 share cards (score_00..score_10).
- **K5** Analytics: `question_answered` carries `is_correct + category +
  position` (correct-count) or `primary_result + secondary_result`
  (archetype). `quiz_complete` carries score/total or total_scores.
  84 Playwright + 143 unit/integration tests.
- **FACTUAL CONTENT GATE (post-review addition)** — `content-facts/<quizId>.json`
  is now a build-time QA artefact: every question must declare a
  `correct.id` matching the live quiz, a `claim`, and at least one
  `http(s)` source URL. Enforced by
  `tests/unit/factualProvenance.test.ts`. No runtime cost.
- **Archetype hardening** — `loadQuiz` now FAILS at load time if an
  archetype answer is missing `scores` (previously silently skipped).
  Future city / archetype quizzes cannot accidentally ship answers
  without weights.

## Architecture proof
A future archetype quiz (e.g. «Какой город тебе подходит?») needs
only data + assets + the `content-facts/<id>.json` provenance file.
No runtime changes; `loadQuiz` fails fast on every schema drift.
A future correct-count quiz (e.g. «Угадаешь фильмы 2000-х?») needs
the same — and the factual content gate enforces it.

`grep -r "music90s\|m90_" src/features src/app api/_lib` → 0 hits.
Music90s-specific знание инкапсулировано в `src/content/quizzes/music90s/`,
codes registry, score-card generator, тестах и `content-facts/music90s.json`.

## Music90s content (revised and factually verified)

| # | category | diff | question | correct |
|---|----------|------|----------|---------|
| m1 | emoji | easy | ☁️ → «Тучи» | c (verified: Wikipedia «Тучи (песня)», 1996) |
| m2 | emoji | medium | 💿+📼 → «Главные носители музыки 90-х» | a (Compact Disc + Compact Cassette) |
| m3 | artist | easy | «Крошка моя» — чей голос? | b (Руки Вверх!) |
| m4 | artist | medium | «Тучи» — песня какой группы? | c (Иванушки International) |
| m5 | timeline | medium | кто старше всех? | a (Дискотека Авария 1990) |
| m6 | timeline | hard | что вышло раньше? | b («Тучи» 1996) |
| m7 | title | medium | трек с дебютного альбома Земфиры 1999? | a (Ариведерчи) |
| m8 | title | easy | песня с альбома «Об этом я буду кричать всю ночь»? | a (Тополиный пух) |
| m9 | album | hard | дебютный альбом Иванушки 1996? | b (Конечно он) |
| m10 | artist | hard | кто исполнил «Владимирский централ»? | b (Михаил Круг) |

## Validation

| Gate | Result |
|------|--------|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 143 tests, 13 files |
| `pnpm build` | PASS |
| `pnpm test:e2e` | PASS — 84 tests, 4 viewports |
| Interior exhaustive 98,304 | PASS (regression baseline preserved) |
| FACTUAL CONTENT GATE | PASS (10/10 questions with provenance) |
| Music90s scoring tests | PASS (verified-fact correctAnswerId) |
| Cross-quiz v2 deeplink E2E | PASS |

## Gauntlet (revised)

- External critic calls used: **0** (cost-aware contract; local critic
  authoritative).
- External critic failures / quota exhaustion: N/A.
- **Local critic (revised after factual pass):**
  - K0+K1: STATUS PASS, P0 0, P1 0.
  - K2+K3: STATUS PASS **for mechanics**, but **3 P1 found in human
    review** (m5 wrong answer, m6 wrong year, m7 wrong attribution,
    m8 lyric clue). 139/139 tests did NOT catch this — they only
    prove structural correctness.
  - K4+K5 + factual pass (`3162c2a`): STATUS PASS, P0 0, P1 0,
    P2 0. LARGEST_GAP: none.
- Lesson: a "Content Gauntlet" gate is required for any future
  correct-count quiz. The `content-facts/<quizId>.json` provenance
  + `tests/unit/factualProvenance.test.ts` provides this for Music90s;
  every future correct-count quiz must add the same gate.

## Share
- 11 share cards (score_00..score_10), 1080x1350 JPEG + 256x320 thumb.
- 75 runtime variants.
- Card asset is server-computed from the verified score; image URL
  is never a client-supplied value.
- v2 deeplink: `s2_m90_<band>_<uid>` opens Music90s, never Interior.
- Legacy v1: `share_<result>-<uid>` still routes Interior.

## Deferred intentionally
audio · random question pool · question seeds · friend-score challenge
comparison · backend persistence/DB · leaderboard · daily challenge ·
opaque attribution token (v3) · v3 deep-link

## Worktree
Clean. `git status` → `nothing to commit, working tree clean`,
`Your branch is up to date with 'origin/master'`.