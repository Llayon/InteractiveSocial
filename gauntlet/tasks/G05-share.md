# G05 Share

## Acceptance criteria
- POST /api/share/prepare: initData validation (подпись+freshness) ДО любого
  использования user_id; allowlist resultId; image/deep link только из env
- TELEGRAM_BOT_TOKEN отсутствует в клиентском бандле (grep gate)
- Native shareMessage → share_success ТОЛЬКО на подтверждённом событии;
  закрытие шторки = не успех
- Graceful fallback (navigator.share / clipboard) при любом сбое; без crash
- Placeholder share cards: кроссплатформенный Node-генератор, стабильные ключи

## Status
DONE. Rounds used: 2 (E2E: abort→fulfill для CDN, race в failure-тесте).
Hard gates: unit initData fixtures + E2E share paths PASS.
Security: grep dist — токен не найден.
