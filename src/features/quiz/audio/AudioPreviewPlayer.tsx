import { useEffect } from 'react'
import type { AudioPreviewContent } from '../schema'
import { useAudioPreview } from './useAudioPreview'

export interface AudioPreviewPlayerProps {
  content: AudioPreviewContent
  quizId: string
  questionId: string
  /** Called when replay happens - for telemetry flag */
  onReplayed?: () => void
  /** Called when user chooses to skip after error */
  onSkip?: () => void
  /** Whether answer feedback is visible (to reveal track info) */
  revealTrackInfo?: boolean
  /** Whether controls should be disabled (during feedback lock) */
  disabled?: boolean
}

export function AudioPreviewPlayer({
  content,
  quizId,
  questionId,
  onReplayed,
  onSkip,
  revealTrackInfo = false,
  disabled = false,
}: AudioPreviewPlayerProps) {
  const { state, errorType, play, replay, retry } = useAudioPreview({
    content,
    quizId,
    questionId,
  })

  useEffect(() => {
    // preload next audio is handled by Quiz level; no extra here
  }, [])

  const isPlaying = state === 'playing'
  const isLoading = state === 'loading'
  const isError = state === 'error'
  const isPlayed = state === 'played'

  const handlePlay = () => {
    if (disabled) return
    if (isPlaying || isLoading) return
    play()
  }

  const handleReplay = () => {
    if (disabled) return
    replay()
    onReplayed?.()
  }

  return (
    <div className="audio-preview" data-testid="audio-preview" data-state={state} data-track-id={content.trackId}>
      <div className="audio-preview__controls">
        {isError ? (
          <>
            <button
              type="button"
              className="button button--secondary audio-preview__play"
              data-testid="audio-retry-button"
              onClick={retry}
              disabled={disabled}
            >
              Повторить
            </button>
            {onSkip && (
              <button
                type="button"
                className="button button--ghost audio-preview__skip"
                data-testid="audio-skip-button"
                onClick={() => {
                  // do not count as wrong - just advance
                  onSkip()
                }}
                disabled={disabled}
              >
                Пропустить
              </button>
            )}
            <span className="audio-preview__error" data-testid="audio-error" data-error-type={errorType ?? ''}>
              {errorType === 'preview_timeout' ? 'Превышено время ожидания' : 'Не удалось загрузить превью'}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button button--primary audio-preview__play"
              data-testid="audio-play-button"
              onClick={state === 'played' ? handleReplay : handlePlay}
              disabled={disabled || isPlaying || isLoading}
              aria-label={state === 'played' ? 'Повторить фрагмент' : 'Воспроизвести фрагмент 4 секунды'}
            >
              {isLoading ? 'Загрузка…' : isPlaying ? 'Играет…' : state === 'played' ? 'Повторить ▶︎' : 'PLAY ▶︎'}
            </button>
            {isPlayed && (
              <button
                type="button"
                className="button button--ghost"
                data-testid="audio-replay-button"
                onClick={handleReplay}
                disabled={disabled || isPlaying}
              >
                Ещё раз
              </button>
            )}
            <span className="audio-preview__state" data-testid="audio-state" aria-live="polite">
              {isPlaying ? 'Играет 4 секунды' : isPlayed ? 'Фрагмент прослушан' : isLoading ? 'Загрузка' : 'Готов к воспроизведению'}
            </span>
          </>
        )}
      </div>

      <p className="audio-preview__attribution" data-testid="audio-attribution">
        Preview provided courtesy of Apple
      </p>

      {revealTrackInfo && (content.trackTitle || content.artistName) && (
        <div className="audio-preview__track-info" data-testid="audio-track-info">
          {content.artistName && <p className="audio-preview__artist">{content.artistName}</p>}
          {content.trackTitle && <p className="audio-preview__title">{content.trackTitle}</p>}
          <a
            href={content.trackViewUrl}
            target="_blank"
            rel="noreferrer"
            className="audio-preview__link"
            data-testid="audio-apple-link"
          >
            Open in Apple Music
          </a>
        </div>
      )}
    </div>
  )
}
