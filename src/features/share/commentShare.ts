import { resolveAcquisitionAttribution } from '@/analytics/attribution'
import type { Quiz } from '@/features/quiz/schema'
import type { PlatformKind } from '@/platform/types'

/**
 * Generic comment-share helpers (config-driven, quiz-agnostic).
 *
 * Visibility is determined by:
 *   quiz.commentShare config + campaign attribution + trusted post URL.
 * No hardcoded quiz ids or post URLs outside quiz config.
 */

export interface CommentShareResolution {
  visible: boolean
  campaignId?: string
  telegramPostUrl?: string
  cta?: string
  copiedLabel?: string
}

export interface ResolveCommentShareParams {
  quiz: Quiz
  platform: PlatformKind
  startParam: string | null
}

/** Only https://t.me/... post links from quiz config are trusted. */
export function isTrustedTelegramPostUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false
  const trimmed = url.trim()
  // Reject arbitrary schemes explicitly (javascript:, data:, file:, etc.)
  if (/^(javascript|data|file|vbscript|blob):/i.test(trimmed)) return false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.hostname.toLowerCase() !== 't.me') return false
  // Require channel post shape: /<channel>/<messageId>
  // e.g. /takeiteasybefore/2435 — channel root (/<channel>) is NOT enough.
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return false
  const channel = segments[0]
  const messageId = segments[1]
  if (!/^[A-Za-z0-9_]{5,}$/.test(channel)) return false
  if (!/^\d+$/.test(messageId)) return false
  return true
}

/**
 * Resolve the configured post URL for a campaign (trusted only).
 * Returns null when no mapping exists or URL fails validation.
 */
export function resolveCommentSharePostUrl(quiz: Quiz, campaignId: string | undefined): string | null {
  if (!campaignId) return null
  const entry = quiz.commentShare?.posts?.[campaignId]
  if (!entry) return null
  const url = entry.telegramPostUrl
  if (!isTrustedTelegramPostUrl(url)) return null
  return url
}

/**
 * Canonical comment text for correct-count quizzes:
 *   `У меня ${score}/${total} — ${result.title}. А у вас сколько?`
 * Avoids double punctuation when title already ends with punctuation/emoji.
 * Never adds promotional URLs or handles (caller must not append them).
 */
export function formatCommentResultText(score: number, total: number, resultTitle: string): string {
  const title = (resultTitle ?? '').trim()
  const needsDot = title.length > 0 && !/[.!?…\p{Extended_Pictographic}\uFE0F\u200D]$/u.test(title)
  const titlePart = needsDot ? `${title}.` : title
  return `У меня ${score}/${total} — ${titlePart} А у вас сколько?`
}

/**
 * Generic visibility resolver — the single authority for showing the CTA.
 * Uses resolveAcquisitionAttribution (no manual post_* parsing at call sites).
 *
 * Visible only when:
 *   - platform is telegram-like (telegram, or mock as telegram double for tests/E2E),
 *   - acquisition_source === 'wife_post_telegram',
 *   - campaign_id maps to a trusted post URL in quiz.commentShare.posts.
 *
 * MAX / browser / challenge / evergreen channel / direct / unknown campaign → hidden.
 */
export function resolveCommentShare(params: ResolveCommentShareParams): CommentShareResolution {
  const { quiz, platform, startParam } = params
  if (!quiz.commentShare) return { visible: false }
  // MAX and browser never show the Telegram comment CTA.
  if (platform === 'max' || platform === 'browser') return { visible: false }
  // Only telegram-like platforms (telegram + mock test double).
  if (platform !== 'telegram' && platform !== 'mock') return { visible: false }

  const attribution = resolveAcquisitionAttribution({ platform, startParam })
  if (attribution.acquisition_source !== 'wife_post_telegram') return { visible: false }
  const campaignId = attribution.campaign_id
  if (!campaignId) return { visible: false }

  const telegramPostUrl = resolveCommentSharePostUrl(quiz, campaignId)
  if (!telegramPostUrl) return { visible: false }

  return {
    visible: true,
    campaignId,
    telegramPostUrl,
    cta: quiz.commentShare.cta,
    copiedLabel: quiz.commentShare.copiedLabel,
  }
}

/** Copy text to clipboard with Telegram WebView fallback. Returns true on success. */
export async function copyCommentText(text: string): Promise<boolean> {
  // Primary: modern Clipboard API.
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to textarea fallback
  }
  // Fallback: temporary textarea + execCommand('copy') for WebViews without Clipboard API.
  try {
    if (typeof document === 'undefined') return false
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    try {
      textarea.focus()
      textarea.select()
      // Some WebViews need explicit selection range.
      try {
        textarea.setSelectionRange(0, textarea.value.length)
      } catch {
        /* ignore */
      }
      const ok = document.execCommand('copy')
      if (ok) return true
      // execCommand may return undefined/false even on success in some browsers;
      // if it didn't throw, treat explicit true only. Fall through to false.
      return false
    } finally {
      try {
        document.body.removeChild(textarea)
      } catch {
        /* ignore */
      }
    }
  } catch {
    return false
  }
}

/** Open a trusted Telegram post URL (config-only, never user input). */
export function openTelegramPostUrl(url: string): void {
  if (!isTrustedTelegramPostUrl(url)) return
  try {
    const w = globalThis as unknown as {
      Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } }
    }
    const openTelegramLink = w.Telegram?.WebApp?.openTelegramLink
    if (typeof openTelegramLink === 'function') {
      openTelegramLink.call(w.Telegram?.WebApp, url)
      return
    }
  } catch {
    // fall through to window.open
  }
  try {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
  } catch {
    /* ignore */
  }
  // Last resort: safe anchor navigation.
  try {
    if (typeof document !== 'undefined') {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } catch {
    /* ignore */
  }
}
