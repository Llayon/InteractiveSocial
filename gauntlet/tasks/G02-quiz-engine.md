# G02 Quiz Engine

## Acceptance criteria
- Zod schema + integrity validation (dangling refs, дубликаты, tie-break refs)
- Утверждённый контент как данные: 8 вопросов (4/4/4/4/4/4/4/6), 6 архетипов
- Content lock тесты: все тексты и веса (+2/+1) сверяются с approved spec
- Детерминированный scoring: 5 стадий tie-break по контракту
- HARD GATE: exhaustive validator 98 304 комбинаций — 6/6 reachable,
  0 nondeterministic; отчёт с распределением

## Status
DONE. Rounds used: 2 (1 раунд ушёл на исправление фикстур под min-2-answers).
Hard gates: все unit/exhaustive тесты PASS.
Critic scope: только соответствие spec + observable evidence из validation report
(корректность scoring верифицируется машиной, не критиком).
Evidence: gauntlet/reports/content-validation.md
