# G06 Analytics

## Acceptance criteria
- Provider abstraction (console по умолчанию), замена без изменения вызовов
- Все события спека + question_answered{primary_result,secondary_result} +
  quiz_complete{result_id,total_scores}
- Общий context: quiz_id/result_id/question_id/answer_id/start_param/source/platform
- trackOnce против дублей от re-render; provider failures не ломают UX

## Status
DONE. Rounds used: 1. Hard gates: integration тесты PASS (события видны в логе).
