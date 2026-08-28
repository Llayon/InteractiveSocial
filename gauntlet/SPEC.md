# Gauntlet SPEC — Telegram Interactive Mini App

## Product

Telegram Mini App with a small **generic quiz platform**. Mechanics are
chosen by explicit discriminator config, not by `quiz.id`:

- scoring.kind        = `archetype` | `correct-count`
- presentation.kind   = `personality` | `score`
- answerBehavior.mode = `instant` | `feedback`

A future archetype quiz (e.g. «Какой город тебе подходит?») needs ZERO
runtime changes — registration + wire codes + assets only. A future
correct-count quiz (e.g. «Угадаешь фильмы 2000-х?») needs the same.

Two production quizzes are live:

1. **Interior Character** — personality / archetype / instant.
2. **Music90s** — score / correct-count / feedback (~2 min, 10 questions,
   «Ты точно помнишь музыку 90-х?»).

## Platform invariants (regression baseline)

- Result id grammar: `^[a-z][a-z0-9_]{0,63}$` (globally unique across quizzes).
- Wire codes live in `src/content/quizzes/codes.ts` only — never in
  `QuizDefinition`. v2 protocol: `s2_<quizCode>_<resultCode>_<uid>`.
- v1 legacy links (`share_<resultId>[-<uid>]`) are parsed forever.
- Quiz resolution order: `quiz_<id>` → v2 codes → legacy → `?quiz=` → default.
- Answer identity is `(questionId, answerId)` — never a global id.
- Dedup key on deliver: `userId + quizId + resultId` (not just
  `userId + resultId`).
- Server-computed image URL on share/deliver (no client URL input).

## Interior Character — locked regression baseline

- Result IDs (LOCKED): `quiet`, `paris`, `italian`, `collector`,
  `cottage`, `scandi`.
- Q1–Q7: 4 answers; Q8: 6 answers → 4^7 × 6 = **98,304 combinations**.
- Weights: primary +2 / secondary +1 (locked).
- Tie-break: 5 stages — max total → q8 control → primary hit count →
  q1→q7→q5 primary order → fixed fallback (`quiet…scandi`).
- Personality presentation: editorial reveal with traits + facts.
- The 98,304 exhaustive validation remains a named hard gate.

## Music90s — correct-count requirements

- 10 fixed questions: 2 emoji / 2 artist / 2 timeline / 2 title /
  2 absurd-description.
- Difficulty: 3 easy / 4 medium / 3 hard.
- 4 options per question, exactly one correct per question.
- Feedback barrier: ~900ms lock with ✓/✕ (and correct answer when wrong).
- Five semantic result bands:
  - 0–2 → m90_rookie  (Ты случайно зашла в 90-е)
  - 3–4 → m90_familiar (Ты где-то это слышала)
  - 5–6 → m90_cassette (Кассетный человек)
  - 7–8 → m90_disco    (Дискотека 1999)
  - 9–10 → m90_legend  (Легенда кассетного века)
- Exact score (e.g. 7/10) is shown alongside the band, NOT a separate
  result per score.
- 11 exact-score share cards (score_00..score_10) generated from one
  template, produced by `scripts/generate-score-cards.ps1`.
- Server-side score validation: integer in [0..total] AND
  `resolveBandResultId(quiz, score) === resultId` (impossible pair
  rejected).
- SECURITY NOTE: the score is client-authoritative in the playful
  result/share MVP. It MUST NOT later be trusted for leaderboards,
  ranking, rewards or prizes.

## Gauntlet tasks

G00 Foundation · G01 Telegram Shell · G02 Quiz Engine · G03 Quiz UX ·
G04 Result · G05 Share · G06 Analytics · G07 Integration.

Music90s expansion:

- K0 — Core generalisation (generic scoring outcomes, registry invariants).
- K1 — Platform cleanup (quiz-aware copy, namespaced ids, wire codes).
- K2 — Correct-count scoring + answer behavior discriminator.
- K3 — Music90s product content (10 questions, 5 bands, copy).
- K4 — Exact-score result + share-card generation (11 score_XX cards).
- K5 — Analytics + cross-mechanic test matrix.

Rules: MAX_ROUNDS=3 on a fix in one milestone; hard gates
(lint/typecheck/tests/build/Playwright/console) before any critic
round; spec-blocked stop on ambiguous criteria; external LLM critic
at most 3 calls total (one per milestone), LOCAL CRITIC is authoritative
when quota is exhausted.

## Definition of Done

All hard gates green + Interior 98,304 PASS + Music90s scoring tests
PASS + 0 P0/P1 in local critic + delivery clean.