import { loadQuiz } from '../../features/quiz/schema'
import { interiorCharacterQuiz } from './interior-character/quiz'

/**
 * Active quiz registry. New personality quizzes are added here as pure
 * configuration — no engine or UI changes required.
 */
const rawQuizzes = [interiorCharacterQuiz]

/** All quizzes validated at module load: build fails on inconsistent content. */
export const quizzes = rawQuizzes.map((raw) => loadQuiz(raw))

export const activeQuiz = quizzes[0]

export function getQuizById(id: string): typeof activeQuiz | undefined {
  return quizzes.find((q) => q.id === id)
}