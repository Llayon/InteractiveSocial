# G08 — Visual Reference & Structural Probe Infrastructure

## Objective
Stand up the deterministic infrastructure for the visual gauntlet: a
machine-checkable structural probe (HARD GATE), real share-card evidence, and
the critic handoff contract. This task does NOT produce a visual PASS — final
judgement requires the vision critic; without it the status stays
`BLOCKED_VISUAL_REVIEW`.

## Approved plan deltas (LOCKED)
Per reviewer clarification, the probe implements four rules to avoid false
positives:

1. **Scroll is allowed.** Essential text is NOT required to fit in the initial
   viewport. The hard gate checks: zero horizontal clipping/overflow, content
   reachable by scrolling in normal flow, and no unintended CSS clipping
   (cut through text by a non-whitelisted `overflow:hidden/clip` ancestor).
   Whitelisted intentional clip: `.result-card` (rounded hero boundary).
2. **Safe-area validation is split.** Presence of `env(safe-area-inset-top/-
   bottom)` is asserted statically against `src/design/tokens.css`. The runtime
   gate checks only real padding/geometry invariants (`#root` padding applied,
   box covers the viewport).
3. **No new share-preview product feature.** `04-share-card.png` is evidence of
   the real static asset `public/share-cards/result_<id>.png` rendered at its
   native 1080×1350 size (asserted via `naturalWidth/Height`).
4. **Forbidden-color checks apply only to UI surfaces/controls/tokens**, never
   to photos or image assets.

## Delivered
- `tests/e2e/structural-probe.spec.ts` — deterministic hard gate
  - no horizontal page overflow + no unintended clipping + text reachable
  - touch targets >= 40px; `.screen` max-width 480px
  - design tokens applied (--bg/--ink/--accent on surfaces), approved
    serif(display)/sans(UI) pairing, no forbidden hues on UI surfaces
  - safe-area: static env() presence + runtime #root geometry
  - result hero `aspect-ratio 4/5` assertion
  - runs on all 4 viewport projects (360×800 / 390×844 / 430×932 / 1280×800)
- `tests/e2e/journey.spec.ts` — added `share-card asset evidence in native
  1080×1350 rendering` (real asset; asserts exact dimensions; screenshots
  `gauntlet/reports/evidence/<viewport>/04-share-card.png`)
- `gauntlet/reports/evidence/<viewport>/01..04-*.png` — refreshed evidence set.

## Status
- Structural probe: PASS on all 16 (4 viewports × 4 tests)
- Journey (incl. share-card evidence): PASS on all 20 (4 viewports × 5 tests)
- VISUAL REVIEW: BLOCKED_VISUAL_REVIEW — awaiting vision critic against
  `references/*.png` (landing.png present; question.png / result.png /
  share-card.png to be added).

## Gap policy
When the critic reports `LARGEST_GAP`, apply exactly one targeted fix per round
(MAX_ROUNDS = 3), re-run all hard gates + probe, re-capture evidence, and hand
back to the critic. No broad redesign.