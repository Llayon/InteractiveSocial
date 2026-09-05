/**
 * Hook on torn pink paper strip — decorative strip is image-only, text is live HTML.
 * Uses the provided torn pink paper strip asset as background element.
 */

export interface Music90HookProps {
  hook: string
}

export function Music90Hook({ hook }: Music90HookProps) {
  if (!hook) return null
  return (
    <div className="m90-hook-wrap" data-testid="result-hook-wrap">
      <img
        className="m90-hook-bg"
        src="/optimized/music90s/result/m90-hook-strip.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="eager"
        onError={(e) => {
          const t = e.currentTarget
          if (t.src.endsWith('.webp')) t.src = '/optimized/music90s/result/m90-hook-strip.png'
        }}
      />
      <div className="m90-hook-text" data-testid="result-hook">
        {hook}
      </div>
    </div>
  )
}
