# G01 Telegram Shell

## Acceptance criteria
- Единый adapter interface (`ready/expand/getStartParam/getUser/getInitDataRaw/haptic/shareMessage`)
- Telegram-специфичный код ТОЛЬКО в `src/platform/telegram`
- Три явных режима: telegram / mock / browser; mock ≠ browser fallback
- Real-имплементация на @tma.js/sdk; детерминированный мок для dev/E2E
- Design tokens: editorial aesthetic (ivory/graphite/burgundy, serif+sans)

## Status
DONE. Rounds used: 1. Hard gates: lint/typecheck PASS.
Notes: escape-hatch для Bot API 9.x share-методов изолирован в real.ts.
