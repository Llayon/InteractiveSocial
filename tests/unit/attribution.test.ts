import { describe, expect, it } from 'vitest'
import { resolveAcquisitionAttribution } from '@/analytics/attribution'

describe('attribution resolver', () => {
  it('challenge telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: 's2_m90_cs_123', platform: 'telegram' })).toEqual({
      acquisition_channel: 'challenge',
      acquisition_source: 'challenge_telegram',
    })
  })
  it('challenge max', () => {
    expect(resolveAcquisitionAttribution({ startParam: 's2_m90_cs_123', platform: 'max' })).toEqual({
      acquisition_channel: 'challenge',
      acquisition_source: 'challenge_max',
    })
  })
  it('challenge differentiation same param different platform', () => {
    const param = 's2_m90_cs_123'
    const tg = resolveAcquisitionAttribution({ startParam: param, platform: 'telegram' })
    const mx = resolveAcquisitionAttribution({ startParam: param, platform: 'max' })
    expect(tg.acquisition_source).toBe('challenge_telegram')
    expect(mx.acquisition_source).toBe('challenge_max')
    expect(tg.acquisition_channel).toBe('challenge')
    expect(mx.acquisition_channel).toBe('challenge')
    expect(tg.campaign_id).toBeUndefined()
    expect(mx.campaign_id).toBeUndefined()
  })
  it('challenge browser', () => {
    expect(resolveAcquisitionAttribution({ startParam: 's2_m90_lg_123456', platform: 'browser' })).toEqual({
      acquisition_channel: 'challenge',
      acquisition_source: 'challenge_browser',
    })
  })
  it('legacy share telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'share_m90_rookie', platform: 'telegram' })).toEqual({
      acquisition_channel: 'legacy_share',
      acquisition_source: 'legacy_share_telegram',
    })
  })
  it('legacy share max', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'share_m90_rookie', platform: 'max' })).toEqual({
      acquisition_channel: 'legacy_share',
      acquisition_source: 'legacy_share_max',
    })
  })
  it('wife_post telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'telegram' })).toEqual({
      acquisition_channel: 'wife_post',
      acquisition_source: 'wife_post_telegram',
      campaign_id: 'music90s_launch',
    })
  })
  it('wife_post max', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'max' })).toEqual({
      acquisition_channel: 'wife_post',
      acquisition_source: 'wife_post_max',
      campaign_id: 'music90s_launch',
    })
  })
  it('wife_post browser', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'browser' })).toEqual({
      acquisition_channel: 'wife_post',
      acquisition_source: 'wife_post_browser',
      campaign_id: 'music90s_launch',
    })
  })
  it('wife_post campaign differentiation same source different campaign', () => {
    const a = resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'telegram' })
    const b = resolveAcquisitionAttribution({ startParam: 'post_music90s_reminder', platform: 'telegram' })
    expect(a.acquisition_source).toBe('wife_post_telegram')
    expect(b.acquisition_source).toBe('wife_post_telegram')
    expect(a.campaign_id).toBe('music90s_launch')
    expect(b.campaign_id).toBe('music90s_reminder')
  })
  it('wife_channel telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'channel_music90s', platform: 'telegram' })).toEqual({
      acquisition_channel: 'wife_channel',
      acquisition_source: 'wife_channel_telegram',
      campaign_id: 'music90s',
    })
  })
  it('wife_channel max', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'channel_music90s', platform: 'max' })).toEqual({
      acquisition_channel: 'wife_channel',
      acquisition_source: 'wife_channel_max',
      campaign_id: 'music90s',
    })
  })
  it('wife_channel evergreen vs post', () => {
    const ch = resolveAcquisitionAttribution({ startParam: 'channel_music90s', platform: 'telegram' })
    const pst = resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'telegram' })
    expect(ch.acquisition_channel).toBe('wife_channel')
    expect(pst.acquisition_channel).toBe('wife_post')
    expect(ch.campaign_id).toBe('music90s')
    expect(pst.campaign_id).toBe('music90s_launch')
  })
  it('channel_tg legacy prefix stripped but platform authority', () => {
    // start_param contains tg hint but platform is max -> should still be max
    expect(resolveAcquisitionAttribution({ startParam: 'channel_tg_music90s_launch', platform: 'max' })).toEqual({
      acquisition_channel: 'wife_channel',
      acquisition_source: 'wife_channel_max',
      campaign_id: 'music90s_launch',
    })
    expect(resolveAcquisitionAttribution({ startParam: 'channel_max_music90s_launch', platform: 'telegram' })).toEqual({
      acquisition_channel: 'wife_channel',
      acquisition_source: 'wife_channel_telegram',
      campaign_id: 'music90s_launch',
    })
  })
  it('quiz_launch telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'quiz_music90s', platform: 'telegram' })).toEqual({
      acquisition_channel: 'quiz_launch',
      acquisition_source: 'quiz_launch_telegram',
      campaign_id: 'music90s',
    })
  })
  it('quiz_launch max', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'quiz_music90s', platform: 'max' })).toEqual({
      acquisition_channel: 'quiz_launch',
      acquisition_source: 'quiz_launch_max',
      campaign_id: 'music90s',
    })
  })
  it('quiz_launch browser', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'quiz_music90s', platform: 'browser' })).toEqual({
      acquisition_channel: 'quiz_launch',
      acquisition_source: 'quiz_launch_browser',
      campaign_id: 'music90s',
    })
  })
  it('direct browser', () => {
    expect(resolveAcquisitionAttribution({ startParam: null, platform: 'browser' })).toEqual({
      acquisition_channel: 'direct',
      acquisition_source: 'direct_browser',
    })
    expect(resolveAcquisitionAttribution({ startParam: undefined, platform: 'browser' })).toEqual({
      acquisition_channel: 'direct',
      acquisition_source: 'direct_browser',
    })
    expect(resolveAcquisitionAttribution({ startParam: '', platform: 'browser' })).toEqual({
      acquisition_channel: 'direct',
      acquisition_source: 'direct_browser',
    })
  })
  it('direct telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: null, platform: 'telegram' })).toEqual({
      acquisition_channel: 'direct',
      acquisition_source: 'direct_telegram',
    })
  })
  it('direct max', () => {
    expect(resolveAcquisitionAttribution({ startParam: null, platform: 'max' })).toEqual({
      acquisition_channel: 'direct',
      acquisition_source: 'direct_max',
    })
  })
  it('other telegram', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'unknown', platform: 'telegram' })).toEqual({
      acquisition_channel: 'other',
      acquisition_source: 'other_telegram',
    })
  })
  it('other max', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'unknown', platform: 'max' })).toEqual({
      acquisition_channel: 'other',
      acquisition_source: 'other_max',
    })
  })
  it('other browser', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'unknown', platform: 'browser' })).toEqual({
      acquisition_channel: 'other',
      acquisition_source: 'other_browser',
    })
  })
  it('campaign_id invalid not leaked', () => {
    // Upper case, spaces, huge, special chars should not create campaign_id
    const r1 = resolveAcquisitionAttribution({ startParam: 'post_Music90s', platform: 'telegram' })
    expect(r1.campaign_id).toBeUndefined()
    const r2 = resolveAcquisitionAttribution({ startParam: 'post_music90s!launch', platform: 'telegram' })
    expect(r2.campaign_id).toBeUndefined()
    const long = 'post_' + 'a'.repeat(70)
    const r3 = resolveAcquisitionAttribution({ startParam: long, platform: 'telegram' })
    expect(r3.campaign_id).toBeUndefined()
    expect(r3.acquisition_channel).toBe('wife_post')
  })
  it('campaign_id boundary 64 chars allowed, 65 not', () => {
    const ok = 'post_' + 'a'.repeat(64)
    const over = 'post_' + 'a'.repeat(65)
    expect(resolveAcquisitionAttribution({ startParam: ok, platform: 'telegram' }).campaign_id).toBe('a'.repeat(64))
    expect(resolveAcquisitionAttribution({ startParam: over, platform: 'telegram' }).campaign_id).toBeUndefined()
  })
  it('pure function does not mutate', () => {
    const p = { startParam: 'post_music90s_launch', platform: 'telegram' as const }
    const before = { ...p }
    resolveAcquisitionAttribution(p)
    expect(p).toEqual(before)
  })
  it('mock platform maps to telegram suffix', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'post_music90s_launch', platform: 'mock' })).toEqual({
      acquisition_channel: 'wife_post',
      acquisition_source: 'wife_post_telegram',
      campaign_id: 'music90s_launch',
    })
    expect(resolveAcquisitionAttribution({ startParam: null, platform: 'mock' })).toEqual({
      acquisition_channel: 'direct',
      acquisition_source: 'direct_telegram',
    })
  })
  it('channel without campaign', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'channel', platform: 'telegram' })).toEqual({
      acquisition_channel: 'wife_channel',
      acquisition_source: 'wife_channel_telegram',
    })
  })
  it('post without campaign', () => {
    expect(resolveAcquisitionAttribution({ startParam: 'post', platform: 'telegram' })).toEqual({
      acquisition_channel: 'wife_post',
      acquisition_source: 'wife_post_telegram',
    })
  })
  it('s2 not valid pattern falls to other', () => {
    // missing uid part
    expect(resolveAcquisitionAttribution({ startParam: 's2_m90_cs', platform: 'telegram' }).acquisition_channel).toBe('other')
  })
})
