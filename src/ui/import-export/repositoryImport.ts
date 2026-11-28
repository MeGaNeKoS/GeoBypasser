import { parseGitHubTreeEntries } from '@schemas/githubTree'
import { button } from '../components/button'
import { draftOf, draftValues, openSheet } from '../components/sheet'
import type { Draft, Fault } from '../components/sheet'
import { element } from '../dom'
import { importConfigFromUrl } from './configImport'
import type { ImportReport } from './configImport'

export type GitHubRepository = {
  owner: string;
  repo: string;
  prefix: string;
}

export const COMMUNITY_RULES: GitHubRepository = { owner: 'MeGaNeKoS', repo: 'GeoBypass-Rules', prefix: '' }

const GITHUB_REPOSITORY_URL = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.*))?\/?$/
const JSON_SUFFIX = '.json'
const NO_FILES_MESSAGE = 'No rules files were found in that folder.'
const READ_FAILED_MESSAGE = 'Could not read one of the chosen rules files.'
const CHOOSE_FILES_TITLE = 'Choose files'
const CONTINUE_LABEL = 'Continue'
const FILE_FIELD = 'file'
const NO_FILE_CHOSEN_MESSAGE = 'Select at least one file.'
const ROOT_FOLDER_NAME = '/'
const FOLDER_CLASS = 'choose-files__folder'

type RepositoryFile = {
  label: string;
  url: string;
}

type RepositoryFolder = {
  name: string;
  files: RepositoryFile[];
}

export function parseGitHubRepositoryUrl (value: string): GitHubRepository | null {
  const match = value.match(GITHUB_REPOSITORY_URL)
  if (!match) return null
  const [, owner, repo, prefix = ''] = match
  return { owner, repo, prefix }
}

export async function openRepositoryRules (repository: GitHubRepository, report: (result: ImportReport) => void): Promise<void> {
  const files = await listJsonFiles(repository)
  if (files.length === 0) {
    report({ messages: [NO_FILES_MESSAGE], summary: null })
    return
  }
  openSheet({
    title: CHOOSE_FILES_TITLE,
    saveLabel: CONTINUE_LABEL,
    draft: draftOf({}),
    render: () => chooserNodes(repository, files),
    validate: draft => chosenFaults(draft),
    save: draft => { void importChosen(filesNamed(files, draftValues(draft, FILE_FIELD)), report) },
  })
}

function chosenFaults (draft: Draft): Fault[] {
  return draftValues(draft, FILE_FIELD).length === 0 ? [{ field: FILE_FIELD, message: NO_FILE_CHOSEN_MESSAGE }] : []
}

function filesNamed (files: RepositoryFile[], urls: string[]): RepositoryFile[] {
  return files.filter(file => urls.includes(file.url))
}

function chooserNodes (repository: GitHubRepository, files: RepositoryFile[]): Node[] {
  const counter = element('p', { class: 'help', 'aria-live': 'polite' })
  const list = element('div', { class: 'choose-files__folders' },
    ...groupByFolder(files).map(folder => folderGroup(folder)),
  )
  const sync = (): void => syncSelection(list, counter)
  list.addEventListener('change', sync)
  sync()
  return [
    element('p', { class: 'help' }, `${repository.owner}/${repository.repo}`),
    element('div', { class: 'choose-files__bar' },
      button('Select all', { variant: 'quiet', onClick: () => { setFiles(list, true); sync() } }),
      button('Unselect all', { variant: 'quiet', onClick: () => { setFiles(list, false); sync() } }),
      counter,
    ),
    list,
  ]
}

function groupByFolder (files: RepositoryFile[]): RepositoryFolder[] {
  const folders = new Map<string, RepositoryFile[]>()
  for (const file of files) {
    const name = folderNameOf(file.label)
    folders.set(name, [...(folders.get(name) ?? []), file])
  }
  return Array.from(folders, ([name, folderFiles]) => ({ name, files: folderFiles }))
}

function folderNameOf (label: string): string {
  const cut = label.lastIndexOf('/')
  return cut === -1 ? ROOT_FOLDER_NAME : label.slice(0, cut)
}

function fileNameOf (label: string): string {
  return label.slice(label.lastIndexOf('/') + 1)
}

function folderGroup (folder: RepositoryFolder): HTMLFieldSetElement {
  const folderBox = element('input', { type: 'checkbox' })
  const group = element('fieldset', { class: FOLDER_CLASS },
    element('legend', {}, element('label', { class: 'checkbox' }, folderBox, element('span', { class: 'mono' }, folder.name))),
    ...folder.files.map(fileRow),
  )
  folderBox.addEventListener('change', () => setFiles(group, folderBox.checked))
  return group
}

function fileRow (file: RepositoryFile): HTMLLabelElement {
  return element('label', { class: 'checkbox' },
    element('input', { type: 'checkbox', name: FILE_FIELD, value: file.url }),
    element('span', { class: 'mono' }, fileNameOf(file.label)),
  )
}

function syncSelection (list: HTMLElement, counter: HTMLElement): void {
  counter.textContent = `${fileBoxesOf(list).filter(box => box.checked).length} selected`
  for (const group of Array.from(list.querySelectorAll<HTMLFieldSetElement>(`.${FOLDER_CLASS}`))) {
    const folderBox = group.querySelector<HTMLInputElement>('legend input')
    if (folderBox) folderBox.checked = fileBoxesOf(group).every(box => box.checked)
  }
}

function setFiles (root: ParentNode, checked: boolean): void {
  for (const box of fileBoxesOf(root)) box.checked = checked
}

function fileBoxesOf (root: ParentNode): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(`input[name="${FILE_FIELD}"]`))
}

async function listJsonFiles (repository: GitHubRepository): Promise<RepositoryFile[]> {
  const { owner, repo } = repository
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const folder = folderPathOf(repository.prefix)
  return parseGitHubTreeEntries(await response.json())
    .filter(entry => entry.type === 'blob' && entry.path.endsWith(JSON_SUFFIX) && entry.path.startsWith(folder))
    .map(entry => ({ label: entry.path.slice(folder.length), url: rawUrlOf(owner, repo, entry.path) }))
}

function folderPathOf (prefix: string): string {
  const trimmed = prefix.replace(/\/+$/, '')
  return trimmed ? `${trimmed}/` : ''
}

function rawUrlOf (owner: string, repo: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`
}

async function importChosen (files: RepositoryFile[], report: (result: ImportReport) => void): Promise<void> {
  for (const file of files) {
    report(await importRepositoryFile(file.url))
  }
}

async function importRepositoryFile (url: string): Promise<ImportReport> {
  try {
    return await importConfigFromUrl(url)
  } catch {
    return { messages: [READ_FAILED_MESSAGE], summary: null }
  }
}
