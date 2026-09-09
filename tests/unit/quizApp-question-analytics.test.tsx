import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizApp } from '@/app/QuizApp'
import { __resetAnalyticsForTests, initAnalytics } from '@/analytics/analytics'
import { MUSIC90_CATEGORY_BY_ID } from '@/content/quizzes/music90s/select'
import type { MiniAppAdapter } from '@/platform/types'
import { ELAPSED_MS_CAP } from '@/analytics/questionAnalytics'

function createMockAdapter(startParam: string | null = 'quiz_music90s'): MiniAppAdapter {
  return {
    platform: 'mock',
    mode: 'mock',
    ready: vi.fn(),
    expand: vi.fn(),
    getStartParam: vi.fn(() => startParam),
    getUser: vi.fn(() => ({ id: 1, firstName: 'Test' })),
    getInitDataRaw: vi.fn(() => ''),
    haptic: vi.fn(),
  } as unknown as MiniAppAdapter
}

function createCollector() {
  const events: Array<{ event: string; properties: Record<string, unknown> }> = []
  const provider = {
    track: (event: string, properties: Record<string, unknown>) => {
      events.push({ event, properties })
    },
  }
  return { events, provider }
}

describe('QuizApp question-level analytics', () => {
  beforeEach(() => {
    __resetAnalyticsForTests()
    vi.restoreAllMocks()
  })

  it('run_id exists, valid, same for all questions of one run, quiz_start and quiz_complete share it', async () => {
    const user = userEvent.setup()
    const { events, provider } = createCollector()
    initAnalytics({ provider, baseContext: { platform: 'mock', anonymous_id: 'anon-1', session_id: 'sess-1' } })
    const adapter = createMockAdapter()

    render(<QuizApp adapter={adapter} />)

    // start
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())

    const startEvent = events.find((e) => e.event === 'quiz_start')
    expect(startEvent).toBeDefined()
    const runId = startEvent?.properties.run_id as string
    expect(typeof runId).toBe('string')
    expect(runId.length).toBeGreaterThan(5)
    expect(startEvent?.properties.question_count).toBe(18)

    // first question_view should have same run_id
    await waitFor(() => {
      const view = events.find((e) => e.event === 'question_view' && e.properties.position === 1)
      expect(view).toBeDefined()
    })
    const view1 = events.find((e) => e.event === 'question_view' && e.properties.position === 1)!
    expect(view1.properties.run_id).toBe(runId)
    expect(view1.properties.question_count).toBe(18)
    expect(view1.properties.quiz_id).toBe('music90s')
    expect(typeof view1.properties.question_id).toBe('string')
    expect(MUSIC90_CATEGORY_BY_ID[view1.properties.question_id as string]).toBe(view1.properties.category)

    // answer first question
    const qid1 = screen.getByTestId('quiz-question').getAttribute('data-question-id')!
    await user.click(screen.getAllByTestId('answer-option')[0])
    // wait for advance to position 2 (feedback 900ms)
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('02 / 18'), { timeout: 3000 })

    const answered1 = events.find((e) => e.event === 'question_answered' && e.properties.question_id === qid1)
    expect(answered1).toBeDefined()
    expect(answered1?.properties.run_id).toBe(runId)
    expect(answered1?.properties.position).toBe(1)
    expect(answered1?.properties.question_count).toBe(18)
    expect(typeof answered1?.properties.is_correct).toBe('boolean')
    expect(typeof answered1?.properties.elapsed_ms).toBe('number')
    expect((answered1?.properties.elapsed_ms as number) >= 0).toBe(true)
    expect((answered1?.properties.elapsed_ms as number) <= ELAPSED_MS_CAP).toBe(true)
    // no question/answer text
    expect(answered1?.properties.question_text).toBeUndefined()
    expect(answered1?.properties.answer_text).toBeUndefined()

    // answer remaining 17 to reach complete
    for (let i = 2; i <= 18; i++) {
      await user.click(screen.getAllByTestId('answer-option')[0])
      if (i < 18) {
        await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent(`${String(i + 1).padStart(2, '0')} / 18`), { timeout: 3000 })
      }
    }
    await waitFor(() => expect(screen.getByTestId('result-screen')).toBeInTheDocument(), { timeout: 5000 })

    const complete = events.find((e) => e.event === 'quiz_complete')
    expect(complete).toBeDefined()
    expect(complete?.properties.run_id).toBe(runId)
    expect(complete?.properties.quiz_id).toBe('music90s')
  }, 20000)

  it('question_view deduplicated on rerender and back navigation', async () => {
    const user = userEvent.setup()
    const { events, provider } = createCollector()
    initAnalytics({ provider, baseContext: {} })
    render(<QuizApp adapter={createMockAdapter()} />)
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())

    await waitFor(() => {
      const v = events.filter((e) => e.event === 'question_view' && e.properties.position === 1)
      expect(v.length).toBe(1)
    })
    const countBefore = events.filter((e) => e.event === 'question_view').length
    // trigger rerender via state update? we can force react rerender by clicking same? Instead we just check that duplicate view not emitted on same position
    // go to next via answer
    await user.click(screen.getAllByTestId('answer-option')[0])
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('02 / 18'), { timeout: 3000 })
    await waitFor(() => {
      const v2 = events.filter((e) => e.event === 'question_view' && e.properties.position === 2)
      expect(v2.length).toBe(1)
    })
    // go back
    await user.click(screen.getByTestId('back-button'))
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('01 / 18'))
    // should not emit second view for position 1
    await new Promise((r) => setTimeout(r, 200))
    const viewsPos1 = events.filter((e) => e.event === 'question_view' && e.properties.position === 1)
    expect(viewsPos1.length).toBe(1)
    expect(events.filter((e) => e.event === 'question_view').length).toBe(countBefore + 1) // only one new for pos2
  }, 15000)

  it('restart creates new run_id, same question can reappear with different run', async () => {
    const user = userEvent.setup()
    const { events, provider } = createCollector()
    initAnalytics({ provider, baseContext: {} })
    render(<QuizApp adapter={createMockAdapter()} />)
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())
    const firstRun = events.find((e) => e.event === 'quiz_start')!.properties.run_id as string
    // complete quickly
    for (let i = 1; i <= 18; i++) {
      await user.click(screen.getAllByTestId('answer-option')[0])
      if (i < 18) await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent(`${String(i + 1).padStart(2, '0')} / 18`), { timeout: 3000 })
    }
    await waitFor(() => expect(screen.getByTestId('result-screen')).toBeInTheDocument(), { timeout: 5000 })
    await user.click(screen.getByTestId('restart-button'))
    await waitFor(() => expect(screen.getByTestId('start-cta')).toBeInTheDocument())
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())
    const secondRun = events.filter((e) => e.event === 'quiz_start').pop()!.properties.run_id as string
    expect(secondRun).not.toBe(firstRun)
    // new run should allow new question_view even for same question id (if sampled same)
    await waitFor(() => {
      const views = events.filter((e) => e.event === 'question_view' && e.properties.run_id === secondRun)
      expect(views.length).toBeGreaterThan(0)
    })
  }, 25000)

  it('question_answered deduplicated on double click', async () => {
    const user = userEvent.setup()
    const { events, provider } = createCollector()
    initAnalytics({ provider, baseContext: {} })
    render(<QuizApp adapter={createMockAdapter()} />)
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())
    const qid = screen.getByTestId('quiz-question').getAttribute('data-question-id')!
    // double click quickly (feedback lock should prevent second)
    const firstOption = screen.getAllByTestId('answer-option')[0]
    await user.click(firstOption)
    await user.click(firstOption).catch(() => undefined)
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('02 / 18'), { timeout: 3000 })
    const answered = events.filter((e) => e.event === 'question_answered' && e.properties.question_id === qid)
    expect(answered.length).toBe(1)
  }, 15000)

  it('elapsed_ms capped at 600_000', async () => {
    // direct helper test, but also ensure computeElapsedMs is used via mocked performance
    const { events, provider } = createCollector()
    initAnalytics({ provider, baseContext: {} })
    // mock performance.now to simulate huge elapsed
    let now = 0
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now)
    render(<QuizApp adapter={createMockAdapter()} />)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())
    // set start at 0, then jump to 1_000_000 before answer
    now = 0
    // next tick will have view with start 0 (already captured at 0), now jump
    now = 800_000
    await user.click(screen.getAllByTestId('answer-option')[0])
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('02 / 18'), { timeout: 3000 })
    const answered = events.find((e) => e.event === 'question_answered')
    expect(answered).toBeDefined()
    expect(answered!.properties.elapsed_ms).toBe(ELAPSED_MS_CAP)
    spy.mockRestore()
  }, 15000)

  it('does not send question_text or answer_text', async () => {
    const user = userEvent.setup()
    const { events, provider } = createCollector()
    initAnalytics({ provider, baseContext: {} })
    render(<QuizApp adapter={createMockAdapter()} />)
    await user.click(screen.getByTestId('start-cta'))
    await waitFor(() => expect(screen.getByTestId('quiz-screen')).toBeInTheDocument())
    await user.click(screen.getAllByTestId('answer-option')[0])
    await waitFor(() => expect(screen.getByTestId('progress')).toHaveTextContent('02 / 18'), { timeout: 3000 })
    for (const e of events) {
      expect(e.properties.question_text).toBeUndefined()
      expect(e.properties.answer_text).toBeUndefined()
      expect(e.properties.correct_answer_text).toBeUndefined()
    }
  }, 15000)
})
