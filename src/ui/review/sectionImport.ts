import type { ImportNote } from '@utils/importFiles'
import { applyImportDecisions, reviewImport } from '@utils/importReview'
import type { AddCounts, ReviewTargets } from '@utils/importReview'
import { getConfig } from '@utils/storage'
import { askImportReview } from './reviewSheet'

export type SectionImportOutcome = {
  messages: string[];
  targets: ReviewTargets | null;
  added: AddCounts | null;
}

export async function reviewSectionImport (incoming: Partial<ReviewTargets>, notes: ImportNote[]): Promise<SectionImportOutcome> {
  const stored = await getConfig()
  const review = reviewImport(stored, incoming, notes)
  const messages = [...review.notes.refused, ...review.notes.ignored].map(note => note.text)
  const decisions = await askImportReview(review)
  if (decisions === null) return { messages, targets: null, added: null }
  const applied = applyImportDecisions(stored, incoming, review, decisions, () => crypto.randomUUID())
  return { messages, targets: applied.targets, added: applied.added }
}
