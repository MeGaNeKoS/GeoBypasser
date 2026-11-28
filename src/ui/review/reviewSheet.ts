import type { ImportDecisions, ImportReview, ReviewDuplicate, DuplicateResolution } from '@utils/importReview'
import { defaultDecisions, describePlanned, plannedGroupShown } from '@utils/importReview'
import type { ImportNote, ImportableSetting, SettingChange } from '@utils/importFiles'
import { element } from '../dom'
import { banner } from '../components/feedback'
import { segmented } from '../components/controls'
import type { SegmentOption } from '../components/controls'
import { draftOf, openSheet } from '../components/sheet'
import { icon } from '../icons'
import type { IconName } from '../icons'

type SettingChoice = 'keepCurrent' | 'useImported'

const REVIEW_TITLE = 'Review import'
const FAILURE_TITLE = 'Import failed'
const IMPORT_LABEL = 'Import'
const CHOOSE_ANOTHER_LABEL = 'Choose another'
const PLANNED_HEADING = 'To add'
const RESOLUTION_LABELS: Record<DuplicateResolution, string> = {
  keepExisting: 'Keep existing',
  useNew: 'Use new',
  keepBoth: 'Keep both',
}
const SETTING_OPTIONS: SegmentOption<SettingChoice>[] = [
  { value: 'keepCurrent', label: 'Keep current' },
  { value: 'useImported', label: 'Use imported' },
]
const NOTE_ICONS: Record<ImportNote['kind'], IconName> = { refused: 'alert', ignored: 'info' }
const MONO_SETTINGS: ImportableSetting[] = ['testProxyUrl']

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

export function showImportFailure (message: string, chooseAnother: () => void): void {
  openSheet({
    title: FAILURE_TITLE,
    saveLabel: CHOOSE_ANOTHER_LABEL,
    draft: draftOf({}),
    render: () => [banner({ tone: 'danger', text: element('p', {}, message) })],
    validate: () => [],
    save: () => queueMicrotask(chooseAnother),
  })
}

function reviewBody (review: ImportReview, decisions: ImportDecisions): Node[] {
  return [
    ...plannedGroup(review),
    ...attentionGroup([...review.notes.refused, ...review.notes.ignored]),
    ...duplicateGroup(review.duplicates, decisions),
    ...settingGroup(review.settingChanges, decisions),
  ]
}

function plannedGroup (review: ImportReview): Node[] {
  if (!plannedGroupShown(review)) return []
  return [element('h3', {}, PLANNED_HEADING), element('p', {}, describePlanned(review.adds))]
}

function attentionGroup (notes: ImportNote[]): Node[] {
  if (notes.length === 0) return []
  return [
    element('h3', {}, `Needs your attention (${notes.length})`),
    element('ul', { class: 'attention-list' }, ...notes.map(attentionItem)),
  ]
}

function attentionItem (note: ImportNote): HTMLLIElement {
  return element('li', { class: 'attention-item' }, icon(NOTE_ICONS[note.kind]), element('span', {}, note.text))
}

function duplicateGroup (duplicates: ReviewDuplicate[], decisions: ImportDecisions): Node[] {
  if (duplicates.length === 0) return []
  return [
    element('h3', {}, `Already in your list (${duplicates.length})`),
    ...duplicates.map(duplicate => duplicateChoice(duplicate, decisions)),
  ]
}

function duplicateChoice (duplicate: ReviewDuplicate, decisions: ImportDecisions): HTMLFieldSetElement {
  const options: SegmentOption<DuplicateResolution>[] = duplicate.allowedResolutions.map(resolution => ({
    value: resolution,
    label: RESOLUTION_LABELS[resolution],
  }))
  return segmented(
    element('span', { class: 'mono' }, duplicate.label),
    duplicate.key,
    options,
    decisions.duplicates[duplicate.key],
    resolution => {
      decisions.duplicates[duplicate.key] = resolution
    },
  )
}

function settingGroup (changes: SettingChange[], decisions: ImportDecisions): Node[] {
  if (changes.length === 0) return []
  return [
    element('h3', {}, `Settings in this file (${changes.length})`),
    ...changes.map(change => settingChoice(change, decisions)),
  ]
}

function settingChoice (change: SettingChange, decisions: ImportDecisions): HTMLDivElement {
  const selected: SettingChoice = decisions.settings.includes(change.setting) ? 'useImported' : 'keepCurrent'
  return element('div', { class: 'setting-choice' },
    segmented(change.title, `setting-${change.setting}`, SETTING_OPTIONS, selected, choice => {
      decisions.settings = settingsAfterChoice(decisions.settings, change.setting, choice)
    }),
    element('p', {}, 'Current: ', valueText(change.setting, change.oldText)),
    element('p', {}, 'Imported: ', valueText(change.setting, change.newText)),
  )
}

function settingsAfterChoice (settings: ImportableSetting[], setting: ImportableSetting, choice: SettingChoice): ImportableSetting[] {
  const others = settings.filter(current => current !== setting)
  return choice === 'useImported' ? [...others, setting] : others
}

function valueText (setting: ImportableSetting, text: string): HTMLSpanElement {
  return element('span', { class: MONO_SETTINGS.includes(setting) ? 'mono' : '' }, text)
}
