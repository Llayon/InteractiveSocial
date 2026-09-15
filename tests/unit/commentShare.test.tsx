import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import {
  formatCommentResultText,
  isTrustedTelegramPostUrl,
  resolveCommentShare,
  resolveCommentSharePostUrl,
} from '@/features/share/commentShare'
import { CommentShareButton } from '@/features/share/CommentShareButton'
import { __resetAnalyticsForTests, initAnalytics } from '@/analytics/analytics'

function makeProvider() {
  const events: Array<{ event: string; payload: Record<string, unknown> }> = []
  const provider = {
    track: (event: string, payload: Record<string, unknown>) => {
      events.push({ event, payload })
    },
  }
  return { events, provider }
}

describe('commentShare: visibility (config + attribution)', () => {
  it('telegram + post_music90s_launch → visible', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'telegram', startParam: 'post_music90s_launch' })
    expect(r.visible).toBe(true)
    expect(r.campaignId).toBe('music90s_launch')
    expect(r.telegramPostUrl).toBe('https://t.me/takeiteasybefore/2435')
  })

  it('mock + post_music90s_launch → visible (telegram double for tests/E2E)', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'mock', startParam: 'post_music90s_launch' })
    expect(r.visible).toBe(true)
    expect(r.telegramPostUrl).toBe('https://t.me/takeiteasybefore/2435')
  })

  it('telegram + channel_music90s → hidden (evergreen, no post mapping)', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'telegram', startParam: 'channel_music90s' })
    expect(r.visible).toBe(false)
  })

  it('telegram + quiz_music90s → hidden', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'telegram', startParam: 'quiz_music90s' })
    expect(r.visible).toBe(false)
  })

  it('telegram + s2_* → hidden', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'telegram', startParam: 's2_m90_lg_123456' })
    expect(r.visible).toBe(false)
  })

  it('telegram + no start_param → hidden', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'telegram', startParam: null })
    expect(r.visible).toBe(false)
  })

  it('max + post_music90s_launch → hidden', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'max', startParam: 'post_music90s_launch' })
    expect(r.visible).toBe(false)
  })

  it('browser + post_music90s_launch → hidden', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'browser', startParam: 'post_music90s_launch' })
    expect(r.visible).toBe(false)
  })

  it('unknown campaign → hidden', () => {
    const r = resolveCommentShare({ quiz: music90sQuiz, platform: 'telegram', startParam: 'post_unknown_campaign' })
    expect(r.visible).toBe(false)
  })

  it('quiz without commentShare config → hidden even for wife_post', () => {
    const bare = { ...music90sQuiz, commentShare: undefined }
    const r = resolveCommentShare({ quiz: bare as typeof music90sQuiz, platform: 'telegram', startParam: 'post_music90s_launch' })
    expect(r.visible).toBe(false)
  })
})

describe('commentShare: exact post URL', () => {
  it('music90s_launch resolves to exact https://t.me/takeiteasybefore/2435', () => {
    expect(resolveCommentSharePostUrl(music90sQuiz, 'music90s_launch')).toBe(
      'https://t.me/takeiteasybefore/2435',
    )
  })

  it('not channel root, not another message id', () => {
    const url = resolveCommentSharePostUrl(music90sQuiz, 'music90s_launch')!
    expect(url).not.toBe('https://t.me/takeiteasybefore')
    expect(url).toBe('https://t.me/takeiteasybefore/2435')
    expect(url).not.toContain('2436')
  })

  it('config cta/copy frozen', () => {
    expect(music90sQuiz.commentShare?.cta).toBe('Показать результат в комментариях')
    expect(music90sQuiz.commentShare?.copiedLabel).toBe(
      'Результат скопирован — вставьте его в комментариях',
    )
  })
})

describe('commentShare: trusted URL validation', () => {
  it('allows exact post URL', () => {
    expect(isTrustedTelegramPostUrl('https://t.me/takeiteasybefore/2435')).toBe(true)
  })

  it('rejects channel root', () => {
    expect(isTrustedTelegramPostUrl('https://t.me/takeiteasybefore')).toBe(false)
  })

  it('rejects arbitrary schemes', () => {
    expect(isTrustedTelegramPostUrl('javascript:alert(1)')).toBe(false)
    expect(isTrustedTelegramPostUrl('data:text/plain,hi')).toBe(false)
    expect(isTrustedTelegramPostUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects non-t.me hosts', () => {
    expect(isTrustedTelegramPostUrl('https://example.com/takeiteasybefore/2435')).toBe(false)
    expect(isTrustedTelegramPostUrl('http://t.me/takeiteasybefore/2435')).toBe(false)
  })
})

describe('commentShare: formatter', () => {
  it('12/18 plain title gets dot', () => {
    expect(formatCommentResultText(12, 18, 'Слушала MTV сутками')).toBe(
      'У меня 12/18 — Слушала MTV сутками. А у вас сколько?',
    )
  })

  it('15/18 canonical example', () => {
    expect(formatCommentResultText(15, 18, 'Королева школьной дискотеки')).toBe(
      'У меня 15/18 — Королева школьной дискотеки. А у вас сколько?',
    )
  })

  it('18/18 emoji title avoids ✨..', () => {
    const text = formatCommentResultText(18, 18, 'Главред журнала Cool ✨')
    expect(text).toBe('У меня 18/18 — Главред журнала Cool ✨ А у вас сколько?')
    expect(text).not.toContain('✨.')
    expect(text).not.toContain('..')
  })

  it('never includes URLs or handles', () => {
    const text = formatCommentResultText(15, 18, 'Королева школьной дискотеки')
    expect(text).not.toContain('https://')
    expect(text).not.toContain('t.me')
    expect(text).not.toContain('@takeiteasybefore')
  })
})

describe('commentShare: clipboard + analytics', () => {
  beforeEach(() => {
    __resetAnalyticsForTests()
    vi.restoreAllMocks()
    // Ensure no Telegram bridge interferes (force window.open path)
    try {
      delete (globalThis as unknown as Record<string, unknown>).Telegram
    } catch {}
  })

  function renderButton(eventsProvider: { track: (e: string, p: Record<string, unknown>) => void }) {
    initAnalytics({ provider: eventsProvider })
    render(
      <CommentShareButton
        quizId="music90s"
        resultId="m90_legend"
        resultTitle="Королева школьной дискотеки"
        score={15}
        total={18}
        campaignId="music90s_launch"
        telegramPostUrl="https://t.me/takeiteasybefore/2435"
        cta="Показать результат в комментариях"
        copiedLabel="Результат скопирован — вставьте его в комментариях"
        platform="telegram"
      />,
    )
  }

  it('impression exactly once on render (rerender safe)', async () => {
    const { events, provider } = makeProvider()
    const { rerender } = (() => {
      initAnalytics({ provider })
      const utils = render(
        <CommentShareButton
          quizId="music90s"
          resultId="m90_legend"
          resultTitle="Королева школьной дискотеки"
          score={15}
          total={18}
          campaignId="music90s_launch"
          telegramPostUrl="https://t.me/takeiteasybefore/2435"
          cta="Показать результат в комментариях"
          copiedLabel="Результат скопирован — вставьте его в комментариях"
          platform="telegram"
        />,
      )
      return utils
    })()
    await waitFor(() => {
      expect(events.filter((e) => e.event === 'comment_share_impression')).toHaveLength(1)
    })
    rerender(
      <CommentShareButton
        quizId="music90s"
        resultId="m90_legend"
        resultTitle="Королева школьной дискотеки"
        score={15}
        total={18}
        campaignId="music90s_launch"
        telegramPostUrl="https://t.me/takeiteasybefore/2435"
        cta="Показать результат в комментариях"
        copiedLabel="Результат скопирован — вставьте его в комментариях"
        platform="telegram"
      />,
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(events.filter((e) => e.event === 'comment_share_impression')).toHaveLength(1)
    const imp = events.find((e) => e.event === 'comment_share_impression')!
    expect(imp.payload).toMatchObject({
      quiz_id: 'music90s',
      result_id: 'm90_legend',
      score: 15,
      question_count: 18,
      platform: 'telegram',
      campaign_id: 'music90s_launch',
    })
    expect(imp.payload).not.toHaveProperty('comment_text')
    expect(imp.payload).not.toHaveProperty('clipboard_text')
  })

  it('success: clipboard called once with exact string → success + post open, no challenge pollution', async () => {
    const { events, provider } = makeProvider()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderButton(provider)
    expect(screen.getByTestId('comment-share-button')).toHaveTextContent('Показать результат в комментариях')

    fireEvent.click(screen.getByTestId('comment-share-button'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    expect(writeText).toHaveBeenCalledWith('У меня 15/18 — Королева школьной дискотеки. А у вас сколько?')

    await waitFor(() => {
      expect(screen.getByTestId('comment-share-status')).toHaveTextContent('copied')
    })
    expect(screen.getByTestId('comment-share-hint')).toHaveTextContent(
      'Результат скопирован — вставьте его в комментариях',
    )
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith(
      'https://t.me/takeiteasybefore/2435',
      '_blank',
      'noopener,noreferrer',
    )

    const names = events.map((e) => e.event)
    expect(names).toContain('comment_share_click')
    expect(names).toContain('comment_copy_success')
    expect(names).toContain('comment_post_open')
    expect(names).not.toContain('comment_copy_failed')
    expect(names).not.toContain('challenge_click')
    expect(names).not.toContain('share_click')
    expect(names).not.toContain('share_success')
    // click exactly once for one physical click
    expect(names.filter((n) => n === 'comment_share_click')).toHaveLength(1)
  })

  it('primary failure + fallback success → still success, no failed, post opens', async () => {
    const { events, provider } = makeProvider()
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    // Fallback via execCommand succeeds (jsdom lacks execCommand — stub it)
    const doc = document as unknown as Record<string, unknown>
    const prevExec = doc['execCommand']
    doc['execCommand'] = vi.fn(() => true)
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderButton(provider)
    fireEvent.click(screen.getByTestId('comment-share-button'))

    await waitFor(() => {
      expect(screen.getByTestId('comment-share-status')).toHaveTextContent('copied')
    })
    const names = events.map((e) => e.event)
    expect(names).toContain('comment_copy_success')
    expect(names).not.toContain('comment_copy_failed')
    expect(openSpy).toHaveBeenCalledTimes(1)
    if (prevExec === undefined) delete doc['execCommand']
    else doc['execCommand'] = prevExec
  })

  it('both fail → failed, post NOT opened, UI remains usable', async () => {
    const { events, provider } = makeProvider()
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const doc2 = document as unknown as Record<string, unknown>
    const prevExec2 = doc2['execCommand']
    doc2['execCommand'] = vi.fn(() => false)
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderButton(provider)
    fireEvent.click(screen.getByTestId('comment-share-button'))

    await waitFor(() => {
      expect(screen.getByTestId('comment-share-status')).toHaveTextContent('failed')
    })
    expect(screen.getByTestId('comment-share-hint')).toHaveTextContent(
      'Не удалось скопировать. Попробуйте ещё раз.',
    )
    expect(openSpy).not.toHaveBeenCalled()
    const names = events.map((e) => e.event)
    expect(names).toContain('comment_copy_failed')
    expect(names).not.toContain('comment_copy_success')
    expect(names).not.toContain('comment_post_open')
    // button still usable
    expect(screen.getByTestId('comment-share-button')).toBeEnabled()
    if (prevExec2 === undefined) delete doc2['execCommand']
    else doc2['execCommand'] = prevExec2
  })
})
