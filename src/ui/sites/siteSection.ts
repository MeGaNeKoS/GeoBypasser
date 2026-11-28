import { supportsProxyOnRequest } from '@utils/env'
import { buildSitesExport } from '@utils/exportFiles'
import { overrideRows } from '@utils/pageView'
import { siteMapWithout } from '@utils/siteDraft'
import type { SiteMap } from '@utils/siteDraft'
import { getConfig } from '@utils/storage'
import { button } from '../components/button'
import { badge, banner } from '../components/feedback'
import { importNotesBanner } from '../components/import-notes'
import { listSection, setAsideBadge, setAsideReason } from '../components/list-section'
import type { ListRow } from '../components/list-section'
import { nothingLeftToFix, setAsideBanners } from '../components/set-aside-view'
import type { SetAsideViewOptions } from '../components/set-aside-view'
import { element, replaceContent, requireElement } from '../dom'
import { downloadJsonFile } from '../download'
import { isSetAsideOnlyHash } from '../shell/routes'
import { importSiteFile } from './siteImport'
import { openSiteEditor } from './siteSheet'
import { changeSiteMap } from './siteStore'

const SITE_CONTAINER_ID = 'overrideContent'
const SITE_IMPORT_INPUT_ID = 'siteImportInput'
const SITE_SECTION_HASH = 'sites'
const SITE_HELP_FIREFOX = 'Send everything a tab on one site loads through a proxy, or directly.'
const SITE_HELP_CHROME = 'Send one site through a proxy, or directly.'
const CHROME_SCOPE_NOTE = 'On Chrome, a site proxy covers requests to that site and its subdomains only. Things a page loads from other hosts follow your rules and default proxy. On Firefox it covers everything a tab on that site loads.'
const EMPTY_TEXT = 'Send a site through a proxy, or directly. Add one, or import a file of sites.'
const EXPORT_FILENAME = 'overrides.json'

type SiteRow = ReturnType<typeof overrideRows>[number]

let importNotes: string[] = []

export async function renderSiteSection (setAsideOnly = false): Promise<void> {
  const container = requireElement(SITE_CONTAINER_ID)
  const config = await getConfig()
  replaceContent(container, [element('div', { class: 'stack' },
    importNotesBanner(importNotes, dismissImportNotes),
    siteSection(config.perWebsiteOverride, config.proxyList, setAsideOnly),
  )])
}

function rerender (): void {
  void renderSiteSection(isSetAsideOnlyHash(location.hash))
}

function siteSection (map: SiteMap, proxyList: unknown, setAsideOnly: boolean): HTMLElement {
  const picker = element('input', {
    id: SITE_IMPORT_INPUT_ID,
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (event: Event) => void importFrom(event),
  })
  const rows = overrideRows(map, proxyList)
  const view: SetAsideViewOptions = {
    sectionHash: SITE_SECTION_HASH,
    noun: 'site',
    nounPlural: 'sites',
    count: rows.filter(row => row.invalid).length,
    onlyShown: setAsideOnly,
  }
  const shownRows = setAsideOnly ? rows.filter(row => row.invalid) : rows
  return element('div', {}, picker, listSection({
    title: 'Sites',
    help: supportsProxyOnRequest ? SITE_HELP_FIREFOX : SITE_HELP_CHROME,
    titleBadge: supportsProxyOnRequest ? undefined : badge('limited'),
    noun: 'site',
    nounPlural: 'sites',
    addLabel: 'Add site',
    state: 'populated',
    rows: shownRows.map(row => rowFor(map, row)),
    banners: [...chromeScopeBanner(), ...setAsideBanners(view)],
    empty: setAsideOnly
      ? nothingLeftToFix(view)
      : {
        title: 'No sites yet',
        text: EMPTY_TEXT,
        actions: [
          button('Add site', { variant: 'primary', onClick: () => void openSiteEditor({ onSaved: rerender }) }),
          button('Import', { onClick: () => picker.click() }),
        ],
      },
    onAdd: () => void openSiteEditor({ onSaved: rerender }),
    onImport: () => picker.click(),
    onRetry: rerender,
    onRemove: domains => void removeSites(domains),
    onExport: domains => exportSites(map, domains),
  }))
}

function chromeScopeBanner (): Node[] {
  if (supportsProxyOnRequest) return []
  return [banner({ tone: 'info', text: CHROME_SCOPE_NOTE })]
}

function proxyMention (row: SiteRow): HTMLSpanElement {
  if (row.direct) return element('span', { class: 'help' }, row.proxyLabel)
  return element('span', { class: 'help' }, 'via ', element('span', row.proxyLabelIsId ? { class: 'mono' } : {}, row.proxyLabel))
}

function rowFor (map: SiteMap, row: SiteRow): ListRow {
  return {
    id: row.domain,
    name: row.domain,
    setAside: row.invalid,
    body: [
      element('div', { class: 'row__title' },
        element('strong', { class: 'mono' }, row.domain),
        ...(row.invalid ? [setAsideBadge()] : []),
        ...(row.missingProxy && !row.invalid ? [badge('unavailable')] : []),
        proxyMention(row),
      ),
      ...(row.invalid ? [setAsideReason(row.faults)] : []),
    ],
    actions: [
      button(row.invalid ? 'Fix' : 'Edit', {
        focusKey: `edit-${row.domain}`,
        onClick: () => void openSiteEditor({
          entry: { domain: row.domain, proxyId: storedProxyIdOf(map, row.domain), needsReview: row.invalid },
          onSaved: rerender,
        }),
      }),
    ],
  }
}

function storedProxyIdOf (map: SiteMap, domain: string): string {
  const proxyId = map[domain]
  return typeof proxyId === 'string' ? proxyId : ''
}

async function removeSites (domains: string[]): Promise<void> {
  await changeSiteMap(map => siteMapWithout(map, domains))
  rerender()
}

function exportSites (map: SiteMap, domains: string[]): string {
  const chosen = Object.fromEntries(Object.entries(map).filter(([domain]) => domains.includes(domain)))
  const count = Object.keys(chosen).length
  downloadJsonFile(EXPORT_FILENAME, JSON.stringify(buildSitesExport(chosen), null, 2))
  return `Exported ${count} ${count === 1 ? 'site' : 'sites'}.`
}

async function importFrom (event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importNotes = await importSiteFile(file)
  input.value = ''
  rerender()
}

function dismissImportNotes (): void {
  importNotes = []
  rerender()
}
