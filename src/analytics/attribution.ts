import type { PlatformKind } from '@/platform/types'

export type AcquisitionChannel =
  | 'wife_channel'
  | 'wife_post'
  | 'challenge'
  | 'quiz_launch'
  | 'legacy_share'
  | 'direct'
  | 'other'

export type AcquisitionSource =
  | 'wife_channel_telegram'
  | 'wife_channel_max'
  | 'wife_channel_browser'
  | 'wife_post_telegram'
  | 'wife_post_max'
  | 'wife_post_browser'
  | 'challenge_telegram'
  | 'challenge_max'
  | 'challenge_browser'
  | 'quiz_launch_telegram'
  | 'quiz_launch_max'
  | 'quiz_launch_browser'
  | 'legacy_share_telegram'
  | 'legacy_share_max'
  | 'legacy_share_browser'
  | 'direct_browser'
  | 'direct_telegram'
  | 'direct_max'
  | 'other_browser'
  | 'other_telegram'
  | 'other_max'

export interface AcquisitionAttribution {
  acquisition_channel: AcquisitionChannel
  acquisition_source: AcquisitionSource
  campaign_id?: string
}

export interface ResolveAcquisitionAttributionParams {
  startParam?: string | null
  platform: PlatformKind
}

const CAMPAIGN_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

function normalizeCampaignId(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed.length > 64) return undefined
  if (!CAMPAIGN_ID_RE.test(trimmed)) return undefined
  return trimmed
}

function isMockPlatform(platform: PlatformKind): boolean {
  return platform === 'mock'
}

function effectivePlatformSuffix(platform: PlatformKind): 'telegram' | 'max' | 'browser' {
  if (platform === 'telegram' || isMockPlatform(platform)) return 'telegram'
  if (platform === 'max') return 'max'
  return 'browser'
}

/**
 * Pure resolver — no side effects, no global mutation.
 * Platform is authority; start_param content never overrides platform.
 */
export function resolveAcquisitionAttribution(
  params: ResolveAcquisitionAttributionParams,
): AcquisitionAttribution {
  const rawStartParam = params.startParam ?? null
  const startParam = typeof rawStartParam === 'string' ? rawStartParam.trim() : null
  const platform = params.platform
  const suffix = effectivePlatformSuffix(platform)
  // For 'mock' we still produce telegram sources so E2E can assert wife_post_telegram etc.
  // But direct handling must preserve distinction: mock without param currently in prod would be mock,
  // however spec requires direct_browser for browser no param. For mock, we map to direct_telegram
  // so that tests using ?mock=1 still exercise telegram path.

  // Empty / missing → direct
  if (!startParam) {
    // platform authority for direct
    if (platform === 'telegram' || isMockPlatform(platform)) {
      return { acquisition_channel: 'direct', acquisition_source: 'direct_telegram' }
    }
    if (platform === 'max') {
      return { acquisition_channel: 'direct', acquisition_source: 'direct_max' }
    }
    return { acquisition_channel: 'direct', acquisition_source: 'direct_browser' }
  }

  // s2_* challenge (exact pattern) → challenge
  if (/^s2_[a-z0-9]{1,12}_[a-z0-9]{1,12}_\d{1,15}$/.test(startParam)) {
    const source = `challenge_${suffix}` as AcquisitionSource
    return { acquisition_channel: 'challenge', acquisition_source: source }
  }

  // legacy_share: share_* with that regex
  if (/^share_[a-z][a-z0-9_]{0,63}(?:[.-]\d{1,15})?$/.test(startParam)) {
    const source = `legacy_share_${suffix}` as AcquisitionSource
    return { acquisition_channel: 'legacy_share', acquisition_source: source }
  }

  // channel_* → wife_channel
  if (startParam === 'channel' || startParam.startsWith('channel')) {
    // derive campaign_id from remainder after 'channel' prefix
    // supports:
    //  channel
    //  channel_music90s
    //  channel_music90s_launch
    //  channel_tg_music90s_launch (legacy prefixed) -> we still extract remainder but prefer platform-neutral
    let remainder: string | undefined
    if (startParam === 'channel') {
      remainder = undefined
    } else if (startParam.startsWith('channel_')) {
      remainder = startParam.slice('channel_'.length)
      // Handle legacy channel_tg_ / channel_max_ prefixes:
      // if remainder starts with tg_ or max_, strip it so campaign stays platform-neutral
      // e.g. channel_tg_music90s_launch -> music90s_launch
      if (remainder.startsWith('tg_')) remainder = remainder.slice(3)
      else if (remainder.startsWith('max_')) remainder = remainder.slice(4)
    } else {
      // starts with 'channel' but not 'channel_' e.g. 'channelXYZ' -> treat as channel with no campaign
      remainder = undefined
    }
    const campaign_id = remainder ? normalizeCampaignId(remainder) : undefined
    const source = `wife_channel_${suffix}` as AcquisitionSource
    return {
      acquisition_channel: 'wife_channel',
      acquisition_source: source,
      ...(campaign_id ? { campaign_id } : {}),
    }
  }

  // post_* → wife_post
  if (startParam.startsWith('post_') || startParam === 'post') {
    let remainder: string | undefined
    if (startParam === 'post') remainder = undefined
    else remainder = startParam.slice('post_'.length)
    const campaign_id = remainder ? normalizeCampaignId(remainder) : undefined
    const source = `wife_post_${suffix}` as AcquisitionSource
    return {
      acquisition_channel: 'wife_post',
      acquisition_source: source,
      ...(campaign_id ? { campaign_id } : {}),
    }
  }
  if (startParam.startsWith('post')) {
    // bare 'postXYZ' without underscore → treat as wife_post without campaign
    const source = `wife_post_${suffix}` as AcquisitionSource
    return { acquisition_channel: 'wife_post', acquisition_source: source }
  }

  // quiz_* → quiz_launch
  if (startParam.startsWith('quiz_')) {
    const remainder = startParam.slice('quiz_'.length)
    const campaign_id = remainder ? normalizeCampaignId(remainder) : undefined
    const source = `quiz_launch_${suffix}` as AcquisitionSource
    return {
      acquisition_channel: 'quiz_launch',
      acquisition_source: source,
      ...(campaign_id ? { campaign_id } : {}),
    }
  }
  if (startParam === 'quiz') {
    const source = `quiz_launch_${suffix}` as AcquisitionSource
    return { acquisition_channel: 'quiz_launch', acquisition_source: source }
  }

  // fallback → other
  const source = `other_${suffix}` as AcquisitionSource
  return { acquisition_channel: 'other', acquisition_source: source }
}
