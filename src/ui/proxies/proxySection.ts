import type { ProxyListItem } from '@customTypes/proxy'
import { buildProxiesExport } from '@utils/exportFiles'
import { storedProxyOf } from '@utils/proxyDraft'
import { proxyRows } from '@utils/pageView'
import { isValidProxyId } from '@utils/validity'
import { button } from '../components/button'
import { switchControl } from '../components/controls'
import { banner } from '../components/feedback'
import { ignoredSettingBadge, ignoredSettingReason, listSection, setAsideBadge, setAsideReason } from '../components/list-section'
import type { ListRow } from '../components/list-section'
import { nothingLeftToFix, setAsideBanners } from '../components/set-aside-view'
import type { SetAsideViewOptions } from '../components/set-aside-view'
import { element, replaceContent, requireElement } from '../dom'
import { downloadJsonFile } from '../download'
import { isSetAsideOnlyHash } from '../shell/routes'
import { importProxyFile } from './proxyImport'
import { openProxyEditor } from './proxySheet'
import { changeProxyList, readProxyList } from './proxyStore'

const PROXY_CONTAINER_ID = 'proxyContent'
const PROXY_IMPORT_INPUT_ID = 'proxyImportInput'
const PROXY_SECTION_HASH = 'proxies'
const PROXY_HELP = 'Proxies that rules, sites and keep-alive checks can use.'
const EMPTY_TEXT = 'Add a proxy, or import a file of proxies.'
const EXPORT_FILENAME = 'proxies.json'

type ProxyRow = ReturnType<typeof proxyRows>[number]

type PasswordReveal = {
  all: boolean;
  overrides: Map<string, boolean>;
}

let importNotes: string[] = []
const passwordReveal: PasswordReveal = { all: false, overrides: new Map() }

export async function renderProxySection (setAsideOnly = false): Promise<void> {
  const container = requireElement(PROXY_CONTAINER_ID)
  const list = await readProxyList()
  replaceContent(container, [element('div', { class: 'stack' }, importNoteBanner(), proxySection(list, setAsideOnly))])
}

export function resetPasswordReveal (): void {
  passwordReveal.all = false
  passwordReveal.overrides.clear()
}

function rerender (): void {
  void renderProxySection(isSetAsideOnlyHash(location.hash))
}

function isPasswordShown (key: string): boolean {
  return passwordReveal.overrides.get(key) ?? passwordReveal.all
}

function togglePassword (key: string): void {
  passwordReveal.overrides.set(key, !isPasswordShown(key))
  rerender()
}

function toggleAllPasswords (): void {
  passwordReveal.all = !passwordReveal.all
  passwordReveal.overrides.clear()
  rerender()
}

function proxySection (list: ProxyListItem[], setAsideOnly: boolean): HTMLElement {
  const picker = element('input', {
    id: PROXY_IMPORT_INPUT_ID,
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (event: Event) => void importFrom(event),
  })
  const rows = proxyRows(list, index => isPasswordShown(keyOf(list[index], index)))
  const view: SetAsideViewOptions = {
    sectionHash: PROXY_SECTION_HASH,
    noun: 'proxy',
    nounPlural: 'proxies',
    count: rows.filter(row => row.invalid).length,
    onlyShown: setAsideOnly,
  }
  const shownRows = setAsideOnly ? rows.filter(row => row.invalid) : rows
  return element('div', {}, picker, listSection({
    title: 'Proxies',
    help: PROXY_HELP,
    noun: 'proxy',
    nounPlural: 'proxies',
    addLabel: 'Add proxy',
    state: 'populated',
    rows: shownRows.map(row => rowFor(list, row)),
    banners: setAsideBanners(view),
    toolbarExtras: [button(passwordReveal.all ? 'Hide all' : 'Show all passwords', { focusKey: 'reveal-all', onClick: toggleAllPasswords })],
    empty: setAsideOnly
      ? nothingLeftToFix(view)
      : {
        title: 'No proxies yet',
        text: EMPTY_TEXT,
        actions: [
          button('Add proxy', { variant: 'primary', onClick: () => openProxyEditor({ onSaved: rerender }) }),
          button('Import', { onClick: () => picker.click() }),
        ],
      },
    onAdd: () => openProxyEditor({ onSaved: rerender }),
    onImport: () => picker.click(),
    onRetry: rerender,
    onRemove: keys => void removeProxies(keys),
    onExport: keys => exportProxies(list, keys),
  }))
}

function rowFor (list: ProxyListItem[], row: ProxyRow): ListRow {
  const proxy = list[row.index]
  const key = keyOf(proxy, row.index)
  return {
    id: key,
    name: row.label,
    setAside: row.invalid,
    body: [
      element('div', { class: 'row__title' },
        element('strong', {}, row.label),
        ...(row.invalid ? [setAsideBadge()] : []),
        ...(row.ignoredNote === undefined ? [] : [ignoredSettingBadge()]),
      ),
      element('div', { class: 'row__meta' },
        element('span', { class: 'badge' }, row.type),
        element('code', { class: 'mono' }, `${row.host}:${row.port}`),
        element('span', { class: 'help' }, userLabelOf(row)),
      ),
      element('div', { class: 'row__line' },
        ...passwordLine(key, row),
        element('span', { class: 'help' }, 'Notify if down'),
        switchControl('Notify if down', row.notifyIfDown, checked => void setNotify(key, checked), { focusKey: `switch-${key}` }),
      ),
      ...(row.invalid ? [setAsideReason(row.faults)] : []),
      ...(row.ignoredNote === undefined ? [] : [ignoredSettingReason(row.ignoredNote)]),
      ...(row.rawEntry === undefined ? [] : [element('code', { class: 'mono' }, row.rawEntry)]),
    ],
    actions: [
      button(row.invalid ? 'Fix' : 'Edit', {
        focusKey: `edit-${key}`,
        onClick: () => openProxyEditor({
          entry: { proxy: storedProxyOf(proxy), position: row.index, needsReview: row.invalid || row.ignoredNote !== undefined },
          onSaved: rerender,
        }),
      }),
    ],
  }
}

function passwordLine (key: string, row: ProxyRow): Node[] {
  if (!row.hasPassword) return []
  const shown = isPasswordShown(key)
  return [element('p', { class: 'row__password' },
    'Password ',
    element('span', { class: 'mono' }, row.password),
    ' ',
    button(shown ? 'Hide' : 'Show', { variant: 'quiet', focusKey: `reveal-${key}`, onClick: () => togglePassword(key) }),
  )]
}

function userLabelOf (row: ProxyRow): string {
  return row.username ? `user: ${row.username}` : 'no sign in'
}

function keyOf (proxy: ProxyListItem, index: number): string {
  const id = proxy?.id
  return isValidProxyId(id) ? id : `position-${index}`
}

async function setNotify (key: string, checked: boolean): Promise<void> {
  await changeProxyList(list => list.map((proxy, index) =>
    keyOf(proxy, index) === key ? { ...proxy, notifyIfDown: checked } : proxy))
}

async function removeProxies (keys: string[]): Promise<void> {
  await changeProxyList(list => list.filter((proxy, index) => !keys.includes(keyOf(proxy, index))))
  rerender()
}

function exportProxies (list: ProxyListItem[], keys: string[]): string {
  const chosen = list.filter((proxy, index) => keys.includes(keyOf(proxy, index)))
  downloadJsonFile(EXPORT_FILENAME, JSON.stringify(buildProxiesExport(chosen), null, 2))
  return `Exported ${chosen.length} ${chosen.length === 1 ? 'proxy' : 'proxies'}.`
}

async function importFrom (event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importNotes = await importProxyFile(file)
  input.value = ''
  rerender()
}

function importNoteBanner (): HTMLElement | null {
  if (importNotes.length === 0) return null
  return banner({
    tone: 'warn',
    text: element('ul', {}, ...importNotes.map(message => element('li', {}, message))),
    action: button('Dismiss', { variant: 'quiet', onClick: dismissImportNotes }),
  })
}

function dismissImportNotes (): void {
  importNotes = []
  rerender()
}
