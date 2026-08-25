# G00 Foundation

## Acceptance criteria
- pnpm workspace, Vite + React + TS strict, ESLint/Prettier, Vitest, Playwright конфигурация
- `pnpm lint`, `pnpm typecheck`, `pnpm build` проходят
- Актуальные stable-версии зафиксированы в lockfile

## Status
DONE. Rounds used: 1. Hard gates: lint/typecheck/build PASS.
Notes: pnpm 11 требует настройки билдов в pnpm-workspace.yaml
(dangerouslyAllowAllBuilds), TS 5.9 (TS7 несовместим с typescript-eslint).
