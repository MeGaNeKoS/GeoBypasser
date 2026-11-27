import { element } from '@ui/dom'
import { icon } from '@ui/icons'
import { banner } from '@ui/components/feedback'
import { button } from '@ui/components/button'
import { clearSelections } from '@ui/components/list-section'
import { segmented, type SegmentOption } from '@ui/components/controls'
import { draftOf, openSheet } from '@ui/components/sheet'
import type { ListState } from '../model'
import type { SectionContext } from '../pages/section-context'
import { openChooseFilesSheet, type ChooseFilesSource } from './choose-files-sheet'

export type ImportSource = ChooseFilesSource | 'file' | 'url'

type DuplicateChoice = 'keep-existing' | 'use-new' | 'keep-both'
type SettingChoice = 'keep-current' | 'use-imported'

const DUPLICATE_OPTIONS: SegmentOption<DuplicateChoice>[] = [
  { value: 'keep-existing', label: 'Keep existing' },
  { value: 'use-new', label: 'Use new' },
  { value: 'keep-both', label: 'Keep both' },
]

const SETTING_OPTIONS: SegmentOption<SettingChoice>[] = [
  { value: 'keep-current', label: 'Keep current' },
  { value: 'use-imported', label: 'Use imported' },
]

const ADDED_SUMMARY = 'Imported 4 rules, 1 proxy, 2 keep-alive rules'
const EMPTY_TEXT = 'Nothing in this file can be imported.'
const INVALID_TEXT = 'This file is not valid JSON.'

export function openReviewSheet (context: SectionContext, source: ImportSource = 'file'): void {
  const listState = context.store.get().listState
  openSheet({
    title: 'Review import',
    saveLabel: 'Import',
    saveDisabled: listState === 'empty',
    draft: draftOf({
      duplicate: 'keep-existing',
      defaultProxy: 'keep-current',
      fallbackDirect: 'keep-current',
      testUrl: 'keep-current',
    }),
    render: (_draft, _faults, close) => reviewBody(listState, context, source, close),
    validate: () => [],
    save: () => finishImport(context),
    footer: listState === 'error' ? () => [] : undefined,
  })
}

function finishImport (context: SectionContext): void {
  clearSelections()
  context.refresh(ADDED_SUMMARY)
}

function reviewBody (listState: ListState, context: SectionContext, source: ImportSource, close: () => void): Node[] {
  if (listState === 'empty') return [group('To add', element('p', {}, EMPTY_TEXT))]
  if (listState === 'error') return invalidFileBody(context, source, close)
  return [
    group('To add', element('p', {}, '4 rules, 1 proxy, 2 keep-alive rules')),
    group('Needs your attention (3)',
      attentionLine('alert', 'Rule "Old" was not imported: match pattern "htp:/x" is not valid.'),
      attentionLine('alert', 'Proxy "entry 3" was not imported: a field is missing or has the wrong type.'),
      attentionLine('info', 'Rule "News" has a staticExtensions value that is not valid, so that setting is ignored.'),
    ),
    group('Already in your list (1)',
      element('p', { class: 'mono' }, '203.0.113.7:1080'),
      segmented('Choose for 203.0.113.7:1080', 'duplicate', DUPLICATE_OPTIONS, 'keep-existing'),
    ),
    group('Settings in this file (3)',
      element('p', {}, 'Default proxy'),
      element('p', { class: 'help' }, 'Current: London HTTP   Imported: Tokyo SOCKS'),
      segmented('Choose for default proxy', 'defaultProxy', SETTING_OPTIONS, 'keep-current'),
      element('p', {}, 'Fall back to direct'),
      element('p', { class: 'help' }, 'Current: On   Imported: Off'),
      segmented('Choose for fall back to direct', 'fallbackDirect', SETTING_OPTIONS, 'keep-current'),
      element('p', {}, 'Test URL'),
      element('p', { class: 'help' }, 'Current: https://a.example/   Imported: https://b.example/'),
      segmented('Choose for test URL', 'testUrl', SETTING_OPTIONS, 'keep-current'),
    ),
  ]
}

function invalidFileBody (context: SectionContext, source: ImportSource, close: () => void): Node[] {
  return [
    banner({ tone: 'danger', text: INVALID_TEXT }),
    element('div', { class: 'button-row' },
      button('Choose another', {
        variant: 'primary',
        onClick: () => {
          close()
          chooseAnother(context, source)
        },
      }),
      button('Cancel', { onClick: close }),
    ),
  ]
}

function chooseAnother (context: SectionContext, source: ImportSource): void {
  if (source === 'file' || source === 'url') return
  openChooseFilesSheet(context, source)
}

function group (title: string, ...children: Node[]): HTMLElement {
  return element('section', { class: 'review-group' }, element('h3', { class: 'group-label' }, title), ...children)
}

function attentionLine (kind: 'alert' | 'info', text: string): HTMLParagraphElement {
  return element('p', { class: 'review-group__line' }, icon(kind), text)
}
