import type { ImportNote } from '@utils/importFiles'
import { applyImportDecisions, reviewImport, reviewStillHolds } from '@utils/importReview'
import type { AddCounts, ImportReview, ReviewTargets } from '@utils/importReview'
import { getConfig } from '@utils/storage'
import { askImportReview } from './reviewSheet'

export type SectionImportOutcome = {
  messages: string[];
  targets: ReviewTargets | null;
  added: AddCounts | null;
}

export type IncomingFor = (stored: ReviewTargets) => Partial<ReviewTargets>

export async function reviewSectionImport (incomingFor: IncomingFor, notes: ImportNote[]): Promise<SectionImportOutcome> {
  let review = await reviewAgainstStored(incomingFor, notes)
  const messages = [...review.review.notes.refused, ...review.review.notes.ignored].map(note => note.text)
  while (true) {
    const decisions = await askImportReview(review.review)
    if (decisions === null) return { messages, targets: null, added: null }
    const current = await reviewAgainstStored(incomingFor, notes)
    if (reviewStillHolds(review.review, current.review)) {
      const applied = applyImportDecisions(current.stored, current.incoming, current.review, decisions, () => crypto.randomUUID())
      return { messages, targets: applied.targets, added: applied.added }
    }
    review = current
  }
}

type ReviewAgainstStored = {
  stored: ReviewTargets;
  incoming: Partial<ReviewTargets>;
  review: ImportReview;
}

async function reviewAgainstStored (incomingFor: IncomingFor, notes: ImportNote[]): Promise<ReviewAgainstStored> {
  const stored = await getConfig()
  const incoming = incomingFor(stored)
  return { stored, incoming, review: reviewImport(stored, incoming, notes) }
}
