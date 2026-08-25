# G07 Integration Gauntlet

## Acceptance criteria
- Полный journey E2E: open → landing → start → 1–8 → back → change answer →
  result → share attempt → restart — на всех 4 viewport'ах
- 0 pageerror / console.error / unhandled rejection (кроме задокументированного
  намеренного 502 в failure-тесте)
- Визуальная консистентность экранов (скриншоты evidence)
- State continuity между экранами; CI pipeline зелёный end-to-end

## Status
DONE. Rounds used: 2. Hard gates: полный DoD прогон PASS.
Evidence: gauntlet/reports/evidence/<viewport>/*.png
