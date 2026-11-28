import { supportsProxyOnRequest } from '@utils/env'
import { buildKeepAliveExport } from '@utils/exportFiles'
import { keepAliveMapWithout } from '@utils/keepAliveDraft'
import type { KeepAliveMap } from '@utils/keepAliveDraft'
import { keepAliveRows } from '@utils/pageView'
import { getConfig } from '@utils/storage'
import { button } from '../components/button'
import { lockedSwitchText, switchControl } from '../components/controls'
import { badge, banner } from '../components/feedback'
import { importNotesBanner } from '../components/import-notes'
import { ignoredSettingBadge, ignoredSettingReason, listSection, setAsideBadge, setAsideReason } from '../components/list-section'
import type { ListRow } from '../components/list-section'
import { nothingLeftToFix, setAsideBanners } from '../components/set-aside-view'
import type { SetAsideViewOptions } from '../components/set-aside-view'
import { element, replaceContent, requireElement } from '../dom'
import { downloadJsonFile } from '../download'
import { isSetAsideOnlyHash } from '../shell/routes'
import { importKeepAliveFile } from './keepAliveImport'
import { openKeepAliveEditor } from './keepAliveSheet'
import { changeKeepAliveMap } from './keepAliveStore'

const KEEP_ALIVE_CONTAINER_ID = 'keepAliveContent'
const KEEP_ALIVE_IMPORT_INPUT_ID = 'keepAliveImportInput'
const KEEP_ALIVE_SECTION_HASH = 'keep-alive'
const KEEP_ALIVE_HELP = 'Ping URLs periodically to keep proxies active.'
const CHROME_SCOPE_NOTE = 'Firefox only. Keep-alive rules are saved and can be edited, imported and exported here, but checks and down notices run only in Firefox.'
const EMPTY_TEXT = 'Add a keep-alive rule for a proxy, or import a file of rules.'
const EXPORT_FILENAME = 'keepalive.json'

type KeepAliveRow = ReturnType<typeof keepAliveRows>[number]

let importNotes: string[] = []

export async function renderKeepAliveSection (setAsideOnly = false): Promise<void> {
  const container = requireElement(KEEP_ALIVE_CONTAINER_ID)
  const config = await getConfig()
  replaceContent(container, [element('div', { class: 'stack' },
    importNotesBanner(importNotes, dismissImportNotes),
    keepAliveSection(config.keepAliveRules ?? {}, config.proxyList, setAsideOnly),
  )])
}

function rerender (): void {
  void renderKeepAliveSection(isSetAsideOnlyHash(location.hash))
}

function keepAliveSection (map: KeepAliveMap, proxyList: unknown, setAsideOnly: boolean): HTMLElement {
  const picker = element('input', {
    id: KEEP_ALIVE_IMPORT_INPUT_ID,
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (event: Event) => void importFrom(event),
  })
  const rows = keepAliveRows(map, proxyList)
  const view: SetAsideViewOptions = {
    sectionHash: KEEP_ALIVE_SECTION_HASH,
    noun: 'keep-alive rule',
    nounPlural: 'keep-alive rules',
    count: rows.filter(row => row.invalid).length,
    onlyShown: setAsideOnly,
  }
  const shownRows = setAsideOnly ? rows.filter(row => row.invalid) : rows
  return element('div', {}, picker, listSection({
    title: 'Keep-alive',
    help: KEEP_ALIVE_HELP,
    titleBadge: supportsProxyOnRequest ? undefined : badge('firefox'),
    noun: 'keep-alive rule',
    nounPlural: 'keep-alive rules',
    addLabel: 'Add keep-alive rule',
    state: 'populated',
    rows: shownRows.map(rowFor),
    banners: [...chromeScopeBanner(), ...setAsideBanners(view)],
    empty: setAsideOnly
      ? nothingLeftToFix(view)
      : {
        title: 'No keep-alive rules yet',
        text: EMPTY_TEXT,
        actions: [
          button('Add keep-alive rule', { variant: 'primary', onClick: () => void openKeepAliveEditor({ onSaved: rerender }) }),
          button('Import', { onClick: () => picker.click() }),
        ],
      },
    onAdd: () => void openKeepAliveEditor({ onSaved: rerender }),
    onImport: () => picker.click(),
    onRetry: rerender,
    onRemove: proxyIds => void removeKeepAliveRules(proxyIds),
    onExport: proxyIds => exportKeepAliveRules(map, proxyIds),
  }))
}

function chromeScopeBanner (): Node[] {
  if (supportsProxyOnRequest) return []
  return [banner({ tone: 'info', text: CHROME_SCOPE_NOTE })]
}

function rowFor (row: KeepAliveRow): ListRow {
  return {
    id: row.proxyId,
    name: row.proxyLabel,
    setAside: row.invalid,
    body: [
      element('div', { class: 'row__title' },
        row.invalid
          ? lockedSwitchText(row.proxyLabel)
          : switchControl(`Active: ${row.proxyLabel}`, row.active, checked => void setActive(row.proxyId, checked), { focusKey: `switch-${row.proxyId}` }),
        element('strong', {}, row.proxyLabel),
        ...(row.invalid ? [setAsideBadge()] : []),
        ...(row.ignoredNote === undefined ? [] : [ignoredSettingBadge()]),
        ...(row.missingProxy && !row.invalid ? [badge('unavailable')] : []),
      ),
      ...(row.invalid ? [setAsideReason(row.faults)] : []),
      ...(row.ignoredNote === undefined ? [] : [ignoredSettingReason(row.ignoredNote)]),
      ...(row.tabUrls === '' ? [] : [element('div', { class: 'row__meta' }, element('code', { class: 'mono' }, row.tabUrls))]),
      ...(row.rawEntry === undefined ? [] : [element('code', { class: 'mono' }, row.rawEntry)]),
    ],
    actions: [
      button(row.invalid ? 'Fix' : 'Edit', {
        focusKey: `edit-${row.proxyId}`,
        onClick: () => void openKeepAliveEditor({
          entry: { proxyId: row.proxyId, rule: row.raw, needsReview: row.invalid },
          onSaved: rerender,
        }),
      }),
    ],
  }
}

async function setActive (proxyId: string, active: boolean): Promise<void> {
  await changeKeepAliveMap(map => ({ ...map, [proxyId]: { ...map[proxyId], active } }))
}

async function removeKeepAliveRules (proxyIds: string[]): Promise<void> {
  await changeKeepAliveMap(map => keepAliveMapWithout(map, proxyIds))
  rerender()
}

function exportKeepAliveRules (map: KeepAliveMap, proxyIds: string[]): string {
  const chosen = Object.fromEntries(Object.entries(map).filter(([proxyId]) => proxyIds.includes(proxyId)))
  const count = Object.keys(chosen).length
  downloadJsonFile(EXPORT_FILENAME, JSON.stringify(buildKeepAliveExport(chosen), null, 2))
  return `Exported ${count} keep-alive ${count === 1 ? 'rule' : 'rules'}.`
}

async function importFrom (event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importNotes = await importKeepAliveFile(file)
  input.value = ''
  rerender()
}

function dismissImportNotes (): void {
  importNotes = []
  rerender()
}
