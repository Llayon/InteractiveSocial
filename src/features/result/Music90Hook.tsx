/**
 * Hook on torn pink paper strip — decorative strip is image-only, text is live HTML.
 * Uses the provided torn pink paper strip asset as background element.
 */

export interface Music90HookProps {
  hook: string
  strip?: { src: string; fallback: string }
}

export function Music90Hook({ hook, strip }: Music90HookProps) {
  if (!hook) return null
  const bgSrc = strip?.src ?? '/optimized/music90s/result/m90-hook-strip.webp'
  const bgFallback = strip?.fallback ?? '/optimized/music90s/result/m90-hook-strip.png'
  return (
    <div className="m90-hook-wrap" data-testid="result-hook-wrap">
      <img
        className="m90-hook-bg"
        src={bgSrc}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = bgFallback
        }}
      />
      <div className="m90-hook-text" data-testid="result-hook">
        {hook}
      </div>
    </div>
  )
}
