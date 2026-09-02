import type { ChannelPromotionConfig } from './schema.js'
import type { PlatformKind } from '@/platform/types.js'

/**
 * Resolve a valid external channel destination for the current platform.
 * Generic, no quiz-id branching.
 *
 * - platform 'max'  -> only max destination (never fall back to telegram)
 * - any other       -> telegram destination (covers telegram, browser, mock)
 * Returns null when no valid destination exists for the platform.
 */
export function resolvePromotionDestination(
  config: ChannelPromotionConfig | undefined,
  platform: PlatformKind,
): string | null {
  if (!config) return null
  if (platform === 'max') {
    return config.destinations.max?.url ?? null
  }
  // telegram, browser, mock, etc. all resolve to telegram for Pass 1
  return config.destinations.telegram?.url ?? null
}

export function hasValidPromotionForPlatform(
  config: ChannelPromotionConfig | undefined,
  platform: PlatformKind,
): boolean {
  return resolvePromotionDestination(config, platform) !== null
}
