import type { ProxyListItem } from '@customTypes/proxy'
import { buildProxiesExport } from '@utils/exportFiles'
import { storedProxyOf } from '@utils/proxyDraft'
import { proxyRows } from '@utils/pageView'
import { isValidProxyId } from '@utils/validity'
import { button } from '../components/button'
import { switchControl } from '../components/controls'
import { banner } from '../components/feedback'
import { listSection } from '../components/list-section'
import type { ListRow } from '../components/list-section'
import { element, replaceContent, requireElement } from '../dom'
import { downloadJsonFile } from '../download'
import { importProxyFile } from './proxyImport'
import { openProxyEditor } from './proxySheet'
import { changeProxyList, readProxyList } from './proxyStore'

const PROXY_CONTAINER_ID = 'proxyContent'
const PROXY_IMPORT_INPUT_ID = 'proxyImportInput'
const PROXY_HELP = 'Proxies that rules, site overrides and keep-alive checks can use.'
const EMPTY_TEXT = 'Add a proxy, or import a file of proxies.'
const EXPORT_FILENAME = 'proxies.json'

type ProxyRow = ReturnType<typeof proxyRows>[number]

let importNotes: string[] = []

export async function renderProxySection (): Promise<void> {
  const container = requireElement(PROXY_CONTAINER_ID)
  const list = await readProxyList()
  replaceContent(container, [element('div', { class: 'stack' }, importNoteBanner(), proxySection(list))])
}

function rerender (): void {
  void renderProxySection()
}

function proxySection (list: ProxyListItem[]): HTMLElement {
  const picker = element('input', {
    id: PROXY_IMPORT_INPUT_ID,
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (event: Event) => void importFrom(event),
  })
  return element('div', {}, picker, listSection({
    title: 'Proxies',
    help: PROXY_HELP,
    noun: 'proxy',
    nounPlural: 'proxies',
    addLabel: 'Add proxy',
    state: 'populated',
    rows: proxyRows(list).map(row => rowFor(list, row)),
    empty: {
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
      element('strong', {}, row.label),
      element('p', { class: 'help' }, detailsOf(row)),
      switchControl(`Notify if ${row.label} is down`, row.notifyIfDown, checked => void setNotify(key, checked)),
    ],
    actions: [
      button('Edit', { onClick: () => openProxyEditor({ entry: { proxy: storedProxyOf(proxy), position: row.index }, onSaved: rerender }) }),
    ],
  }
}

function detailsOf (row: ProxyRow): string {
  const endpoint = `${row.host}:${row.port}`
  const user = row.username ? ` · ${row.username}` : ''
  return `${row.type} · ${endpoint}${user}`
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
