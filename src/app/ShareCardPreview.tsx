import { useMemo } from 'react'
import { music90sQuiz } from '@/content/quizzes/music90s/quiz'
import { getQuizById } from '@/content/quizzes'
import { Music90ShareCard } from '@/features/share/Music90ShareCard'

function getParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name)
  } catch {
    return null
  }
}

/**
 * Preview page for deterministic share-card generation via Playwright.
 * Route: /?shareCardPreview=1&quiz=music90s&score=10
 * Renders at exactly 1080x1350 for screenshot.
 */
export function ShareCardPreview() {
  const quizId = getParam('quiz') ?? 'music90s'
  const scoreParam = getParam('score')
  const score = scoreParam !== null ? Number(scoreParam) : 10

  const quiz = useMemo(() => {
    return getQuizById(quizId) ?? music90sQuiz
  }, [quizId])

  if (quiz.id === 'music90s') {
    return (
      <div style={{ width: 1080, height: 1350, overflow: 'hidden', background: '#f5efe7' }}>
        <Music90ShareCard quiz={quiz} score={score} />
      </div>
    )
  }

  if (quiz.id === 'guess90s') {
    return (
      <div style={{ width: 1080, height: 1350, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe7', fontSize: 48 }}>
        g90 {score} / {quiz.questions.length}
      </div>
    )
  }

  return <div>unknown quiz {quizId}</div>
}
