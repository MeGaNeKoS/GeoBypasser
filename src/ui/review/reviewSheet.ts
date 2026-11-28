import type { ImportDecisions, ImportReview, ReviewDuplicate, DuplicateResolution } from '@utils/importReview'
import { defaultDecisions, describeAdded } from '@utils/importReview'
import type { ImportNote } from '@utils/importFiles'
import type { SettingChange } from '@utils/importFiles'
import { element } from '../dom'
import { checkbox, segmented } from '../components/controls'
import type { SegmentOption } from '../components/controls'
import { draftOf, openSheet } from '../components/sheet'

const REVIEW_TITLE = 'Review import'
const IMPORT_LABEL = 'Import'
const RESOLUTION_LABELS: Record<DuplicateResolution, string> = {
  keepExisting: 'Skip',
  useNew: 'Replace',
  keepBoth: 'Keep both',
}

export function askImportReview (review: ImportReview): Promise<ImportDecisions | null> {
  return new Promise(resolve => {
    const decisions = defaultDecisions(review)
    openSheet({
      title: REVIEW_TITLE,
      saveLabel: IMPORT_LABEL,
      saveDisabled: !review.canImport,
      draft: draftOf({}),
      render: () => reviewBody(review, decisions),
      validate: () => [],
      save: () => resolve(decisions),
      closed: () => resolve(null),
    })
  })
}

function reviewBody (review: ImportReview, decisions: ImportDecisions): Node[] {
  return [
    element('p', { class: 'help' }, describeAdded(review.adds)),
    ...noteGroup('Refused', review.notes.refused),
    ...noteGroup('Ignored', review.notes.ignored),
    ...review.duplicates.map(duplicate => duplicateChoice(duplicate, decisions)),
    ...review.settingChanges.map(change => settingChoice(change, decisions)),
  ]
}

function noteGroup (heading: string, notes: ImportNote[]): Node[] {
  if (notes.length === 0) return []
  return [
    element('h3', {}, heading),
    element('ul', {}, ...notes.map(note => element('li', {}, note.text))),
  ]
}

function duplicateChoice (duplicate: ReviewDuplicate, decisions: ImportDecisions): HTMLFieldSetElement {
  const options: SegmentOption<DuplicateResolution>[] = duplicate.allowedResolutions.map(resolution => ({
    value: resolution,
    label: RESOLUTION_LABELS[resolution],
  }))
  return segmented(duplicate.label, duplicate.key, options, decisions.duplicates[duplicate.key], resolution => {
    decisions.duplicates[duplicate.key] = resolution
  })
}

function settingChoice (change: SettingChange, decisions: ImportDecisions): HTMLLabelElement {
  return checkbox(
    `${change.title}: ${change.oldText}, becomes ${change.newText}`,
    decisions.settings.includes(change.setting),
    checked => {
      decisions.settings = checked
        ? [...decisions.settings, change.setting]
        : decisions.settings.filter(setting => setting !== change.setting)
    },
  )
}
