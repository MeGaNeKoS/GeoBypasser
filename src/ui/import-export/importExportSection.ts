import { button } from '../components/button'
import { textField } from '../components/fields'
import { statusLine } from '../components/feedback'
import { importNotesBanner } from '../components/import-notes'
import { draftOf, draftValue, faultFor, openSheet } from '../components/sheet'
import type { Fault } from '../components/sheet'
import { element, replaceContent, requireElement } from '../dom'
import { IMPORT_EXPORT_SECTION_ID } from '../shell/routes'
import { importConfigFromUrl, importConfigText } from './configImport'
import type { ImportReport } from './configImport'
import { openExportSheet } from './exportSheet'
import { COMMUNITY_RULES, openRepositoryRules, parseGitHubRepositoryUrl } from './repositoryImport'
import type { GitHubRepository } from './repositoryImport'

const CARDS_ID = 'importExportCards'
const CONFIG_INPUT_ID = 'configImportInput'
const URL_FIELD = 'url'
const JSON_ADDRESS_PATTERN = /\.json$/
const INVALID_URL_MESSAGE = 'Enter a direct link to a .json file, or a GitHub repository or folder.'
const IMPORT_FAILED_MESSAGE = 'Could not import the configuration.'
const LIST_FAILED_MESSAGE = 'Could not load the list of rules from GitHub.'

let lastResult: ImportReport | null = null

export function renderImportExportSection (): void {
  renderCard()
}

function renderCard (): void {
  replaceContent(cardsHost(), [importCard(), exportCard()])
}

function cardsHost (): HTMLElement {
  const existing = document.getElementById(CARDS_ID)
  if (existing) return existing
  const host = element('div', { id: CARDS_ID })
  requireElement(IMPORT_EXPORT_SECTION_ID).prepend(host)
  return host
}

function exportCard (): HTMLElement {
  return element('div', { class: 'card export-card' },
    element('h3', {}, 'Export'),
    row('Configuration file', 'Choose what goes into the file. Leave out usernames and passwords when you will share it.', button('Export config', { onClick: () => void openExportSheet(), focusKey: 'export-config' })),
  )
}

function importCard (): HTMLElement {
  return element('div', { class: 'card import-card' },
    element('h3', {}, 'Import'),
    fileRow(),
    row('From a URL', 'A direct link to a .json file, or a GitHub repository or folder.', button('Enter address', { onClick: openUrlSheet, focusKey: 'import-url' })),
    row('Community rules', 'Choose rules from the community repository.', button('Choose files', { onClick: openCommunity, focusKey: 'import-community' })),
    ...resultNodes(lastResult),
  )
}

function fileRow (): HTMLElement {
  const input = element('input', { id: CONFIG_INPUT_ID, type: 'file', accept: '.json,application/json', hidden: '' })
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) void runImport(async () => importConfigText(await file.text()))
  })
  return row(
    'From a file',
    'Choose a configuration file. Every entry goes through the Review step before anything is saved.',
    button('Choose file', { onClick: () => input.click(), focusKey: 'import-file' }),
    input,
  )
}

function row (title: string, help: string, action: Node, ...extra: Node[]): HTMLElement {
  return element('div', { class: 'import-row' },
    element('div', {}, element('strong', {}, title), element('p', { class: 'help' }, help)),
    action,
    ...extra,
  )
}

function resultNodes (result: ImportReport | null): Node[] {
  if (result === null) return []
  const notes = importNotesBanner(result.messages, dismissResult)
  return [
    ...(notes ? [notes] : []),
    ...(result.summary ? [statusLine(result.summary)] : []),
  ]
}

function dismissResult (): void {
  publish(null)
}

function publish (result: ImportReport | null): void {
  lastResult = result
  renderCard()
}

async function runImport (task: () => Promise<ImportReport>, failure = IMPORT_FAILED_MESSAGE): Promise<void> {
  try {
    publish(await task())
  } catch {
    publish({ messages: [failure], summary: null })
  }
}

function openUrlSheet (): void {
  openSheet({
    title: 'Import from a URL',
    saveLabel: 'Import',
    draft: draftOf({ [URL_FIELD]: '' }),
    render: (draft, faults) => [textField({
      name: URL_FIELD,
      label: 'Address',
      value: draftValue(draft, URL_FIELD),
      type: 'url',
      mono: true,
      placeholder: 'https://example.com/config.json',
      fault: faultFor(faults, URL_FIELD),
      focusKey: URL_FIELD,
    })],
    validate: draft => urlFaults(draftValue(draft, URL_FIELD)),
    save: draft => importFromAddress(draftValue(draft, URL_FIELD)),
  })
}

function urlFaults (value: string): Fault[] {
  return isImportableAddress(value) ? [] : [{ field: URL_FIELD, message: INVALID_URL_MESSAGE }]
}

function isImportableAddress (value: string): boolean {
  if (JSON_ADDRESS_PATTERN.test(value)) return isHttpAddress(value)
  return parseGitHubRepositoryUrl(value) !== null
}

function isHttpAddress (value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function importFromAddress (address: string): void {
  if (JSON_ADDRESS_PATTERN.test(address)) {
    void runImport(() => importConfigFromUrl(address))
    return
  }
  const repository = parseGitHubRepositoryUrl(address)
  if (repository) openRepository(repository)
}

function openCommunity (): void {
  openRepository(COMMUNITY_RULES)
}

function openRepository (repository: GitHubRepository): void {
  openRepositoryRules(repository, publish).catch(() => publish({ messages: [LIST_FAILED_MESSAGE], summary: null }))
}
