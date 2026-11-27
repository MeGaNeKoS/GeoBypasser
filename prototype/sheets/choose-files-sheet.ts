import { element, replaceContent } from '../dom'
import { button } from '../components/button'
import { skeletonRows, stateBlock } from '../components/feedback'
import { draftOf, draftValues, openSheet, setCheckedInputs } from '../components/sheet'
import type { ListState } from '../model'
import type { SectionContext } from '../pages/section-context'
import { openReviewSheet } from './review-sheet'

export type ChooseFilesSource = 'repository' | 'community'

type RepositoryFolder = {
  name: string;
  files: string[];
}

const REPOSITORY_FOLDERS: RepositoryFolder[] = [
  { name: 'services', files: ['video.json', 'music.json', 'news.json', 'sports.json'] },
  { name: 'proxies', files: ['public.json', 'mirror.json', 'backup.json'] },
]

const ALL_FILES = REPOSITORY_FOLDERS.flatMap(folder => folder.files.map(file => `${folder.name}/${file}`))

export function openChooseFilesSheet (context: SectionContext, source: ChooseFilesSource): void {
  openSheet({
    title: 'Choose files',
    saveLabel: 'Continue',
    draft: draftOf({ files: ALL_FILES }),
    render: () => [fileListBody(source, context.store.get().listState)],
    validate: draft => draftValues(draft, 'files').length === 0
      ? [{ field: 'files', message: 'Choose at least one file.' }]
      : [],
    save: () => openReviewSheet(context, source),
  })
}

function fileListBody (source: ChooseFilesSource, state: ListState): HTMLElement {
  const body = element('div', { class: 'stack' })
  renderBody(body, source, state)
  return body
}

function renderBody (body: HTMLElement, source: ChooseFilesSource, state: ListState): void {
  replaceContent(body, [stateContent(source, state, () => renderBody(body, source, 'populated'))])
}

function stateContent (source: ChooseFilesSource, state: ListState, retry: () => void): HTMLElement {
  if (state === 'loading') {
    return element('div', { class: 'stack' }, element('p', { class: 'help' }, 'Reading file list…'), skeletonRows(3))
  }
  if (state === 'empty') {
    return stateBlock({ title: 'No .json files found in this repository.' })
  }
  if (state === 'error') {
    return stateBlock({
      title: 'Could not read the repository.',
      tone: 'danger',
      action: button('Try again', { onClick: retry }),
    })
  }
  return fileSelection(source)
}

function fileSelection (source: ChooseFilesSource): HTMLElement {
  const origin = source === 'community' ? 'Shared rules for known sites' : 'owner/repository'
  const counter = element('p', { class: 'help', role: 'status' }, selectedText(ALL_FILES.length))
  const selection = element('div', { class: 'stack' },
    element('p', { class: 'help mono' }, origin),
    element('div', { class: 'button-row' },
      button('Select all', { onClick: event => setCheckedInputs(event, 'input[name="files"]', true) }),
      button('Unselect all', { onClick: event => setCheckedInputs(event, 'input[name="files"]', false) }),
      counter,
    ),
    ...REPOSITORY_FOLDERS.map(folder => folderGroup(folder)),
  )
  selection.addEventListener('change', () => {
    counter.textContent = selectedText(selection.querySelectorAll('input[name="files"]:checked').length)
  })
  return selection
}

function selectedText (count: number): string {
  return `${count} selected`
}

function folderGroup (folder: RepositoryFolder): HTMLDetailsElement {
  return element('details', { class: 'disclosure', open: true },
    element('summary', { class: 'disclosure__summary' }, element('span', { class: 'mono' }, folder.name)),
    element('div', { class: 'disclosure__body' },
      ...folder.files.map(file => fileCheckbox(`${folder.name}/${file}`, file)),
    ),
  )
}

function fileCheckbox (value: string, label: string): HTMLLabelElement {
  return element('label', { class: 'checkbox' },
    element('input', { type: 'checkbox', name: 'files', value, checked: true }),
    label,
  )
}
