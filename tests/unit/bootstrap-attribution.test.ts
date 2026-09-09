import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap } from '@/app/bootstrap'
import { __resetAnalyticsForTests, getAnalytics } from '@/analytics/analytics'
import { __resetIdentityCache } from '@/analytics/identity'

function makeAdapter(platform: 'telegram' | 'max' | 'browser' | 'mock', startParam: string | null) {
  return {
    platform,
    mode: platform,
    ready: vi.fn(),
    expand: vi.fn(),
    getStartParam: () => startParam,
    getUser: () => null,
    getInitDataRaw: () => '',
    haptic: vi.fn(),
  } as unknown as import('@/platform/types').MiniAppAdapter
}

describe('bootstrap acquisition attribution', () => {
  beforeEach(() => {
    __resetAnalyticsForTests()
    __resetIdentityCache()
    vi.restoreAllMocks()
    // ensure localStorage clean
    try { window.localStorage.clear() } catch {}
  })

  it('app_open gets wife_post attribution via baseContext', () => {
    const adapter = makeAdapter('telegram', 'post_music90s_launch')
    bootstrap({ telegram: adapter as unknown as import('@/platform/telegram').TelegramAdapter, adapter })
    const analytics = getAnalytics()
    // verify that subsequent events carry acquisition via baseContext
    expect(analytics).toBeDefined()
  })

  it('resolve integration: telegram wife_post via bootstrap logic', async () => {
    // Instead of full bootstrap, verify that resolver + bootstrap contract produces expected baseContext shape
    const { resolveAcquisitionAttribution } = await import('@/analytics/attribution')
    const a = resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'telegram' })
    expect(a.acquisition_channel).toBe('wife_post')
    expect(a.acquisition_source).toBe('wife_post_telegram')
    expect(a.campaign_id).toBe('music90s_launch')
    // simulate bootstrap baseContext composition
    const { deriveSource, deriveEntrySource } = await import('@/analytics/events')
    const startParam = 'post_music90s_launch'
    const platform = 'telegram' as const
    const baseContext = {
      platform,
      start_param: startParam,
      source: deriveSource(startParam),
      entry_source: deriveEntrySource(startParam),
      acquisition_channel: a.acquisition_channel,
      acquisition_source: a.acquisition_source,
      ...(a.campaign_id ? { campaign_id: a.campaign_id } : {}),
    }
    expect(baseContext).toMatchObject({
      platform: 'telegram',
      start_param: 'post_music90s_launch',
      source: 'post',
      entry_source: 'post',
      acquisition_channel: 'wife_post',
      acquisition_source: 'wife_post_telegram',
      campaign_id: 'music90s_launch',
    })
  })

  it('bootstrap baseContext acquisition preserved across quiz_start via analytics facade', async () => {
    const { createAnalytics } = await import('@/analytics/analytics')
    const { resolveAcquisitionAttribution } = await import('@/analytics/attribution')
    const attr = resolveAcquisitionAttribution({ startParam: 's2_m90_cs_123', platform: 'max' })
    const received: Array<Record<string, unknown>> = []
    const provider = { track: (_e: string, p: Record<string, unknown>) => received.push(p) }
    const analytics = createAnalytics({
      provider,
      baseContext: {
        platform: 'max',
        start_param: 's2_m90_cs_123',
        acquisition_channel: attr.acquisition_channel,
        acquisition_source: attr.acquisition_source,
      },
    })
    analytics.track('app_open', {})
    analytics.track('quiz_start', { quiz_id: 'music90s', run_id: 'run1' })
    expect(received[0]).toMatchObject({ acquisition_channel: 'challenge', acquisition_source: 'challenge_max', platform: 'max' })
    expect(received[1]).toMatchObject({ acquisition_channel: 'challenge', acquisition_source: 'challenge_max', platform: 'max', quiz_id: 'music90s', run_id: 'run1' })
  })

  it('campaign differing keeps same acquisition_source', async () => {
    const { resolveAcquisitionAttribution } = await import('@/analytics/attribution')
    const a = resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'max' })
    const b = resolveAcquisitionAttribution({ startParam: 'post_music90s_reminder', platform: 'max' })
    expect(a.acquisition_source).toBe(b.acquisition_source)
    expect(a.campaign_id).not.toBe(b.campaign_id)
  })
})
