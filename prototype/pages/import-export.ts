import { element, replaceContent } from '../dom'
import { button } from '../components/button'
import { icon } from '../icons'
import { skeletonRows, stateBlock } from '../components/feedback'
import { textField } from '../components/fields'
import { draftValue, readDraft } from '../components/sheet'
import { isHttpUrl } from '../validation'
import { openChooseFilesSheet } from '../sheets/choose-files-sheet'
import { openExportSheet } from '../sheets/export-sheet'
import { openReviewSheet } from '../sheets/review-sheet'
import type { SectionContext } from './section-context'

const URL_FIELD = 'importUrl'
const GITHUB_HOST = 'github.com'
const JSON_SUFFIX = '.json'
const URL_ERROR = 'Enter a GitHub repository address or a direct .json link.'

type ImportTarget = 'repository' | 'json'

export function importExportSection (context: SectionContext): HTMLElement {
  const { listState } = context.store.get()
  return element('section', { class: 'stack' },
    element('header', { class: 'list-section__header' },
      element('div', { class: 'list-section__header-text' },
        element('h2', { class: 'page-title' }, 'Import and export'),
        element('p', { class: 'help' }, 'Move your settings between browsers, or start from a shared rule set.'),
      ),
    ),
    listState === 'error' ? errorState(context) : listState === 'loading' ? skeletonRows(3) : element('div', { class: 'stack' }, exportCard(context), importCard(context)),
  )
}

function errorState (context: SectionContext): HTMLElement {
  return stateBlock({
    title: 'Could not read the settings.',
    tone: 'danger',
    action: button('Try again', { onClick: () => context.refresh() }),
  })
}

function exportCard (context: SectionContext): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'Export'),
    element('p', { class: 'help' }, 'Usernames and passwords are included in the export.'),
    element('div', { class: 'button-row' },
      button('Export settings', { onClick: () => openExportSheet(context) }),
    ),
  )
}

function importCard (context: SectionContext): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'Import'),
    element('div', { class: 'field__row' },
      element('span', { class: 'field__label' }, 'From a file'),
      button('Choose file', { onClick: () => openReviewSheet(context) }),
    ),
    urlImportForm(context),
    element('div', { class: 'field__row' },
      element('span', { class: 'field__label' }, 'Community rules'),
      button('Browse', { onClick: () => openChooseFilesSheet(context, 'community') }),
      element('p', { class: 'help' }, 'Shared rules for known sites'),
    ),
  )
}

function urlImportForm (context: SectionContext): HTMLFormElement {
  const errors = element('div', { class: 'import-url__errors' })
  const form = element('form', { class: 'import-url', novalidate: true },
    textField({ name: URL_FIELD, label: 'From a URL', type: 'url', value: '', placeholder: 'https://…', help: 'A raw .json link or a GitHub repository address' }),
    element('div', { class: 'button-row' }, element('button', { type: 'submit', class: 'button' }, 'Import')),
    errors,
  )
  form.addEventListener('submit', event => {
    event.preventDefault()
    importFromUrl(draftValue(readDraft(form), URL_FIELD), errors, context)
  })
  return form
}

function importFromUrl (value: string, errors: HTMLElement, context: SectionContext): void {
  const target = importTarget(value)
  if (target === null) {
    replaceContent(errors, [element('p', { class: 'field__error' }, icon('alert'), URL_ERROR)])
    return
  }
  replaceContent(errors, [])
  if (target === 'repository') openChooseFilesSheet(context, 'repository')
  else openReviewSheet(context, 'url')
}

function importTarget (value: string): ImportTarget | null {
  if (!isHttpUrl(value)) return null
  const url = new URL(value)
  if (url.hostname === GITHUB_HOST) return 'repository'
  if (url.pathname.endsWith(JSON_SUFFIX)) return 'json'
  return null
}
