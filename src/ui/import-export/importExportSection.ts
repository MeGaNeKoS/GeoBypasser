import { button } from '../components/button'
import { textField } from '../components/fields'
import { statusLine } from '../components/feedback'
import { importNotesBanner } from '../components/import-notes'
import { sectionHeading } from '../components/section-heading'
import { element, focusableWithKey, replaceContent, requireElement } from '../dom'
import { showImportFailure } from '../review/reviewSheet'
import { hashForSection, IMPORT_EXPORT_SECTION_ID } from '../shell/routes'
import { importConfigFromUrl, importConfigText } from './configImport'
import type { ImportReport } from './configImport'
import { openExportSheet } from './exportSheet'
import { COMMUNITY_RULES, openRepositoryRules, parseGitHubRepositoryUrl } from './repositoryImport'
import type { GitHubRepository } from './repositoryImport'

const CARDS_ID = 'importExportCards'
const HEADING = 'Import and export'
const HELP = 'Back up or restore configuration and import community rules.'
const CONFIG_INPUT_ID = 'configImportInput'
const URL_FIELD = 'url'
const URL_ACTION_KEY = 'import-url'
const COMMUNITY_KEY = 'import-community'
const JSON_ADDRESS_PATTERN = /\.json$/
const URL_HELP = 'A direct link to a .json file, or a GitHub repository or folder.'
const IMPORT_FAILED_MESSAGE = 'Could not import the configuration.'
const LIST_FAILED_MESSAGE = 'Could not load the list of rules from GitHub.'

let lastResult: ImportReport | null = null
let addressDraft = ''
let addressFault: string | null = null

export function renderImportExportSection (): void {
  replaceContent(requireElement(IMPORT_EXPORT_SECTION_ID), [
    element('div', { class: 'stack' },
      sectionHeading(HEADING),
      element('p', { class: 'help' }, HELP),
      element('div', { id: CARDS_ID, class: 'stack' }),
    ),
  ])
  renderCard()
}

export function startCommunityRules (): void {
  window.addEventListener('hashchange', openCommunityOnceShown, { once: true })
  location.hash = `#${hashForSection(IMPORT_EXPORT_SECTION_ID)}`
}

function openCommunityOnceShown (): void {
  focusableWithKey(document.body, COMMUNITY_KEY)?.focus()
  openCommunity()
}

function renderCard (focusKey?: string): void {
  replaceContent(requireElement(CARDS_ID), [importCard(), exportCard()], focusKey)
}

function exportCard (): HTMLElement {
  return element('div', { class: 'settings-card' },
    element('h3', {}, 'Export'),
    row('Configuration file', 'Choose what goes into the file. Leave out usernames and passwords when you will share it.', button('Export config', { onClick: () => void openExportSheet(), focusKey: 'export-config' })),
  )
}

function importCard (): HTMLElement {
  return element('div', { class: 'settings-card' },
    element('h3', {}, 'Import'),
    fileRow(),
    urlRow(),
    row('Community rules', 'Choose rules from the community repository.', button('Browse', { onClick: openCommunity, focusKey: COMMUNITY_KEY })),
    ...resultNodes(lastResult),
  )
}

function fileRow (): HTMLElement {
  const input = element('input', { id: CONFIG_INPUT_ID, type: 'file', accept: '.json,application/json', hidden: '' })
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) void runImport(async () => importConfigText(await file.text()), chooseConfigFile)
  })
  return row(
    'From a file',
    'Choose a configuration file. Every entry goes through the Review step before anything is saved.',
    button('Choose file', { onClick: () => input.click(), focusKey: 'import-file' }),
    input,
  )
}

function urlRow (): HTMLElement {
  return element('div', { class: 'import-url' },
    element('strong', {}, 'From a URL'),
    element('form', { class: 'import-url__entry', onsubmit: submitAddress },
      textField({
        name: URL_FIELD,
        label: 'Address',
        value: addressDraft,
        type: 'url',
        mono: true,
        placeholder: 'https://example.com/config.json',
        fault: addressFault ?? undefined,
        focusKey: URL_FIELD,
        onInput: value => {
          addressDraft = value
        },
      }),
      button('Import', { type: 'submit', focusKey: URL_ACTION_KEY }),
    ),
    element('p', { class: 'help' }, URL_HELP),
  )
}

function submitAddress (event: Event): void {
  event.preventDefault()
  const address = addressDraft.trim()
  addressFault = isImportableAddress(address) ? null : URL_HELP
  renderCard(URL_FIELD)
  if (addressFault === null) importFromAddress(address)
}

function focusAddressField (): void {
  focusableWithKey(requireElement(CARDS_ID), URL_FIELD)?.focus()
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

function chooseConfigFile (): void {
  requireElement(CONFIG_INPUT_ID).click()
}

function clearResult (): void {
  if (lastResult !== null) publish(null)
}

async function runImport (task: () => Promise<ImportReport>, chooseAnother: () => void): Promise<void> {
  clearResult()
  try {
    publish(await task())
  } catch (error) {
    showImportFailure(failureMessage(error), chooseAnother)
  }
}

function failureMessage (error: unknown): string {
  return error instanceof Error ? error.message : IMPORT_FAILED_MESSAGE
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
    void runImport(() => importConfigFromUrl(address), focusAddressField)
    return
  }
  const repository = parseGitHubRepositoryUrl(address)
  if (repository) openRepository(repository, focusAddressField)
}

function openCommunity (): void {
  openRepository(COMMUNITY_RULES, openCommunity)
}

function openRepository (repository: GitHubRepository, chooseAnother: () => void): void {
  clearResult()
  openRepositoryRules(repository, publish).catch(() => showImportFailure(LIST_FAILED_MESSAGE, chooseAnother))
}
