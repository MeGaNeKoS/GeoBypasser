import type { ImportNote } from '@utils/importFiles'
import { applyImportDecisions, reviewImport } from '@utils/importReview'
import type { ReviewTargets } from '@utils/importReview'
import { getConfig } from '@utils/storage'
import { askImportReview } from './reviewSheet'

export type SectionImportOutcome = {
  messages: string[];
  targets: ReviewTargets | null;
}

export async function reviewSectionImport (incoming: Partial<ReviewTargets>, notes: ImportNote[]): Promise<SectionImportOutcome> {
  const stored = await getConfig()
  const review = reviewImport(stored, incoming, notes)
  const messages = [...review.notes.refused, ...review.notes.ignored].map(note => note.text)
  const decisions = await askImportReview(review)
  if (decisions === null) return { messages, targets: null }
  const { targets } = applyImportDecisions(stored, incoming, review, decisions, () => crypto.randomUUID())
  return { messages, targets }
}
