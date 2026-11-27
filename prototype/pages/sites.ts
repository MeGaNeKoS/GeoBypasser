import { element } from '../dom'
import { icon } from '../icons'
import { button } from '../components/button'
import { badge, banner } from '../components/feedback'
import { faultBanner, FaultFilter, nothingLeftToFix } from '../components/fault-filter'
import { listSection, type ListRow } from '../components/list-section'
import { removeIds } from '../collections'
import { routeLabel } from '../proxy-lookup'
import type { Browser, SiteEntry } from '../model'
import { sites } from '../sample-data'
import { openSiteSheet } from '../sheets/site-sheet'
import { openReviewSheet } from '../sheets/review-sheet'
import { exportNotice } from './export-notice'
import type { SectionContext } from './section-context'

const FIREFOX_HELP = 'Send everything a tab on one site loads through a proxy, or directly.'
const CHROME_HELP = 'Send one site through a proxy, or directly.'
const CHROME_LIMIT = 'On Chrome, a site proxy covers requests to that site and its subdomains only. Things a page loads from other hosts follow your rules and default proxy. On Firefox it covers everything a tab on that site loads.'
const SITE_NOUNS = { noun: 'site', nounPlural: 'sites' }
const faultFilter = new FaultFilter()

export function sitesSection (context: SectionContext): HTMLElement {
  const { listState, browser } = context.store.get()
  const entries = listState === 'populated' ? faultFilter.visible(sites, isSetAside) : []
  const refresh = (): void => context.refresh()
  return listSection({
    title: 'Sites',
    help: browser === 'chrome' ? CHROME_HELP : FIREFOX_HELP,
    titleBadge: browser === 'chrome' ? badge('limited') : undefined,
    noun: 'site',
    nounPlural: 'sites',
    addLabel: '+ Add site',
    state: listState,
    rows: entries.map(site => siteRow(site, context)),
    empty: faultFilter.isShowingOnly()
      ? nothingLeftToFix(faultFilter, SITE_NOUNS, refresh)
      : {
        title: 'No sites yet',
        text: 'Add a site to send it through a proxy, or directly.',
        actions: [
          button('+ Add site', { variant: 'primary', onClick: () => openSiteSheet(null, context) }),
          button('Import sites', { onClick: () => openReviewSheet(context) }),
        ],
      },
    banners: listState === 'populated' ? sitesBanners(browser, refresh) : [],
    onAdd: () => openSiteSheet(null, context),
    onImport: () => openReviewSheet(context),
    onRetry: () => context.refresh(),
    onRemove: ids => {
      removeIds(sites, ids)
      context.refresh(`Deleted ${ids.length} ${ids.length === 1 ? 'site' : 'sites'}`)
    },
    onExport: ids => exportNotice(ids.length, 'site'),
  })
}

function sitesBanners (browser: Browser, refresh: () => void): Node[] {
  const setAside = sites.filter(isSetAside).length
  return [
    ...(setAside > 0 ? [faultBanner(faultFilter, setAside, SITE_NOUNS, refresh)] : []),
    ...(browser === 'chrome' ? [chromeBanner()] : []),
  ]
}

function chromeBanner (): HTMLDivElement {
  return banner({ tone: 'info', text: CHROME_LIMIT })
}

function isSetAside (site: SiteEntry): boolean {
  return site.faults.length > 0
}

function siteRow (site: SiteEntry, context: SectionContext): ListRow {
  const setAside = isSetAside(site)
  return {
    id: site.id,
    name: site.domain,
    setAside,
    body: setAside ? setAsideBody(site) : [
      element('div', { class: 'mono' }, site.domain),
      element('div', { class: 'row__meta' }, `via ${routeLabel(site.proxyId)}`),
    ],
    actions: [button(setAside ? 'Fix' : 'Edit', { onClick: () => openSiteSheet(site, context) })],
  }
}

function setAsideBody (site: SiteEntry): Node[] {
  return [
    element('div', { class: 'row__title' },
      element('span', { class: 'row__name' }, site.domain || '(no domain)'),
      badge('not-used'),
    ),
    element('p', { class: 'help row__reason' }, icon('alert'), site.faults.join(' ')),
  ]
}
