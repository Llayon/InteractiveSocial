import type { CSSProperties } from 'react'
import {
  RUNTIME_IMAGE_MANIFEST,
  buildSrcSet,
  type ImageBucket,
  type ImageEntry,
} from './manifest'

export interface OptimizedImageProps {
  /** Semantic key from the runtime manifest (e.g. 'q1_a', 'quiet'). */
  asset: string
  /** Which bucket the asset lives in. */
  bucket: ImageBucket
  /** Optional override of the aspect ratio (defaults to entry's ratio). */
  aspectRatio?: '16/9' | '4/5'
  /** Optional override of the size hint passed to the browser. */
  sizes?: string
  /** Loading hint — defaults to lazy. Hero images should pass 'eager'. */
  loading?: 'eager' | 'lazy'
  /** Fetch priority hint for hero / first-fold images. */
  fetchPriority?: 'high' | 'low' | 'auto'
  /** Decoding hint; 'async' avoids blocking paint on secondary cards. */
  decoding?: 'sync' | 'async' | 'auto'
  /** className for the underlying <img>. */
  className?: string
  /** alt attribute for the <img>. */
  alt?: string
  /** Extra inline styles for the wrapping <picture>. */
  style?: CSSProperties
  /** data-* attribute passthrough for tests (e.g. data-testid). */
  'data-testid'?: string
  /**
   * 'asset' (default) is a fixed-ratio container; the <picture> fills it via
   * 100% width/height. 'intrinsic' lets the <img> dictate size; use when
   * layout already constrains the box.
   */
  layout?: 'asset' | 'intrinsic'
}

/**
 * Renders a <picture> with WebP source + JPEG fallback <img>, including a
 * real srcset across 480/720/960 widths. Always picks the smallest file
 * that satisfies the browser's width slot via the `sizes` hint.
 */
export function OptimizedImage({
  asset,
  bucket,
  aspectRatio,
  sizes,
  loading = 'lazy',
  fetchPriority,
  decoding = 'async',
  className,
  alt = '',
  style,
  layout = 'asset',
  'data-testid': testId,
}: OptimizedImageProps) {
  const entry: ImageEntry | undefined = RUNTIME_IMAGE_MANIFEST[bucket][asset]
  if (!entry) {
    return null
  }
  const ratio = aspectRatio ?? entry.ratio
  const [aw, ah] = ratio === '16/9' ? [16, 9] : [4, 5]
  // Width-driven sizes: smallest variant is 480, largest 960.
  const resolvedSizes =
    sizes ??
    (bucket === 'results'
      ? '(max-width: 480px) calc(100vw - 32px), 480px'
      : '(max-width: 480px) calc(100vw - 32px), 480px')

  const wrapperStyle: CSSProperties =
    layout === 'asset'
      ? {
          aspectRatio: `${aw} / ${ah}`,
          width: '100%',
          height: 'auto',
          overflow: 'hidden',
          display: 'block',
          background: 'var(--surface, #fff)',
          ...style,
        }
      : { display: 'block', ...style }

  return (
    <picture style={wrapperStyle} data-testid={testId}>
      <source type="image/webp" srcSet={buildSrcSet(entry, bucket, asset, 'webp')} sizes={resolvedSizes} />
      <source type="image/jpeg" srcSet={buildSrcSet(entry, bucket, asset, 'jpg')} sizes={resolvedSizes} />
      <img
        src={`/optimized/${bucket}/${asset}-${entry.widths[0]}.jpg`}
        srcSet={buildSrcSet(entry, bucket, asset, 'jpg')}
        sizes={resolvedSizes}
        width={entry.widths[entry.widths.length - 1]}
        height={Math.round((entry.widths[entry.widths.length - 1] * ah) / aw)}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        className={className}
        draggable={false}
        style={layout === 'asset' ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
      />
    </picture>
  )
}