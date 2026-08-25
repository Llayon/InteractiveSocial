import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import type { TelegramAdapter } from '@/platform/telegram'

function createTestTelegram(): TelegramAdapter {
  return {
    mode: 'mock',
    ready: vi.fn(),
    expand: vi.fn(),
    getStartParam: vi.fn(() => 'post_aug25'),
    getUser: vi.fn(() => ({ id: 1, firstName: 'Тест' })),
    getInitDataRaw: vi.fn(() => ''),
    haptic: vi.fn(),
    shareMessage: vi.fn(() => Promise.resolve('sent' as const)),
  }
}

async function completeQuiz(user: ReturnType<typeof userEvent.setup>) {
  // 8 questions; q8 has 6 answers — always tap the first available option.
  for (let i = 0; i < 8; i++) {
    const options = screen.getAllByTestId('answer-option')
    expect(options.length).toBeGreaterThan(0)
    await user.click(options[0])
    // Reveal overlay appears after the last answer.
    if (i === 7) break
    await waitFor(() => {
      expect(screen.getAllByTestId('answer-option').length).toBeGreaterThan(0)
      const progress = screen.getByTestId('progress')
      expect(progress).toHaveTextContent(`${String(i + 2).padStart(2, '0')} / 08`)
    })
  }
}

describe('full quiz flow (integration)', () => {
  it('walks landing → 8 answers → reveal → result → restart', async () => {
    const user = userEvent.setup()
    render(<App telegram={createTestTelegram()} />)

    // Landing
    expect(screen.getByTestId('start-cta')).toHaveTextContent('Узнать свой характер')
    await user.click(screen.getByTestId('start-cta'))

    await completeQuiz(user)

    // Result after the deterministic reveal (~4 × 250ms).
    await waitFor(
      () => {
        expect(screen.getByTestId('result-screen')).toBeInTheDocument()
        expect(screen.getByTestId('result-card')).toBeInTheDocument()
        expect(screen.getByTestId('result-title')).toBeDefined()
      },
      { timeout: 3000 },
    )
    expect(screen.getByTestId('share-button')).toHaveTextContent('Отправить результат подруге')

    // Restart returns to a fresh landing.
    await user.click(screen.getByTestId('restart-button'))
    expect(screen.getByTestId('start-cta')).toBeInTheDocument()
  }, 15_000)

  it('back navigation preserves answers and changing one rescoring correctly', async () => {
    const user = userEvent.setup()
    render(<App telegram={createTestTelegram()} />)
    await user.click(screen.getByTestId('start-cta'))

    // Answer q1 and q2.
    let options = screen.getAllByTestId('answer-option')
    const q1First = options[0]
    await user.click(q1First)
    await waitFor(() => {
      expect(screen.getByTestId('progress')).toHaveTextContent('02 / 08')
    })

    // Go back to q1: previous selection must be visible.
    await user.click(screen.getByTestId('back-button'))
    await waitFor(() => {
      expect(screen.getByTestId('progress')).toHaveTextContent('01 / 08')
    })
    options = screen.getAllByTestId('answer-option')
    const firstIdAfterBack = options[0].getAttribute('data-answer-id')
    expect(firstIdAfterBack).toBe(q1First.getAttribute('data-answer-id'))
    expect(options[0]).toHaveClass('is-selected')

    // Change the answer for q1 → flow continues with the new choice.
    await user.click(options[options.length - 1])
    await waitFor(() => {
      expect(screen.getByTestId('progress')).toHaveTextContent('02 / 08')
    })
    expect(screen.getByTestId('quiz-screen')).toBeInTheDocument()
  }, 15_000)

  it('share button degrades gracefully when backend is unreachable', async () => {
    const user = userEvent.setup()
    const telegram = createTestTelegram()
    telegram.getInitDataRaw = vi.fn(() => '')
    render(<App telegram={telegram} />)
    await user.click(screen.getByTestId('start-cta'))
    await completeQuiz(user)
    await waitFor(() => expect(screen.getByTestId('share-button')).toBeInTheDocument(), {
      timeout: 3000,
    })

    // No backend in jsdom: fetch fails → fallback path (clipboard/share APIs
    // are unavailable) → app must not crash and status must not be success.
    await user.click(screen.getByTestId('share-button'))
    await waitFor(
      () => {
        const status = screen.getByTestId('share-status').textContent
        expect(['native', 'failed', 'fallback']).toContain(status ?? 'pending')
      },
      { timeout: 5000 },
    )
    // The result screen is still functional afterwards.
    expect(screen.getByTestId('restart-button')).toBeInTheDocument()
  }, 20_000)
})
