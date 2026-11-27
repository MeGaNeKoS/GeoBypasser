import { element } from '../dom'
import { icon } from '../icons'
import { button } from '../components/button'
import { switchControl, lockedSwitchText } from '../components/controls'
import { badge, banner } from '../components/feedback'
import { faultBanner, FaultFilter, nothingLeftToFix } from '../components/fault-filter'
import { listSection, type ListRow } from '../components/list-section'
import { removeIds } from '../collections'
import { isUsable, routeLabel } from '../proxy-lookup'
import type { Browser, KeepAliveEntry } from '../model'
import { defaults, keepAliveRules } from '../sample-data'
import { openKeepAliveSheet } from '../sheets/keep-alive-sheet'
import { openReviewSheet } from '../sheets/review-sheet'
import { exportNotice } from './export-notice'
import type { SectionContext } from './section-context'

const HELP = 'While a tab on a listed site is open, checks its proxy and can notify you when it stops answering.'
const EMPTY_TEXT = 'A keep-alive rule checks one proxy while a tab on its listed sites is open.'
const CHROME_NOTE = 'Keep-alive rules are saved and can be edited, imported and exported here, but checks and down notices run only in Firefox.'
const KEEP_ALIVE_NOUNS = { noun: 'keep-alive rule', nounPlural: 'keep-alive rules' }
const faultFilter = new FaultFilter()

export function keepAliveSection (context: SectionContext): HTMLElement {
  const { listState, browser } = context.store.get()
  const entries = listState === 'populated' ? faultFilter.visible(keepAliveRules, isSetAside) : []
  const refresh = (): void => context.refresh()
  return listSection({
    title: 'Keep-alive',
    help: HELP,
    titleBadge: browser === 'chrome' ? badge('firefox') : undefined,
    noun: 'keep-alive rule',
    nounPlural: 'keep-alive rules',
    addLabel: '+ Add rule',
    state: listState,
    rows: entries.map(rule => keepAliveRow(rule, context)),
    empty: faultFilter.isShowingOnly()
      ? nothingLeftToFix(faultFilter, KEEP_ALIVE_NOUNS, refresh)
      : {
        title: 'No keep-alive rules yet',
        text: EMPTY_TEXT,
        actions: [
          button('+ Add rule', { variant: 'primary', onClick: () => openKeepAliveSheet(null, context) }),
          button('Import rules', { onClick: () => openReviewSheet(context) }),
        ],
      },
    banners: listState === 'populated' ? keepAliveBanners(browser, refresh) : [],
    onAdd: () => openKeepAliveSheet(null, context),
    onImport: () => openReviewSheet(context),
    onRetry: () => context.refresh(),
    onRemove: ids => {
      removeIds(keepAliveRules, ids)
      context.refresh(`Deleted ${ids.length} ${ids.length === 1 ? 'rule' : 'rules'}`)
    },
    onExport: ids => exportNotice(ids.length, 'keep-alive rule'),
  })
}

function keepAliveBanners (browser: Browser, refresh: () => void): Node[] {
  const setAside = keepAliveRules.filter(isSetAside).length
  return [
    ...(setAside > 0 ? [faultBanner(faultFilter, setAside, KEEP_ALIVE_NOUNS, refresh)] : []),
    ...(browser === 'chrome' ? [banner({ tone: 'info', text: CHROME_NOTE })] : []),
  ]
}

function isSetAside (rule: KeepAliveEntry): boolean {
  return rule.faults.length > 0
}

function keepAliveRow (rule: KeepAliveEntry, context: SectionContext): ListRow {
  const setAside = isSetAside(rule)
  return {
    id: rule.id,
    name: routeLabel(rule.proxyId),
    setAside,
    body: setAside ? setAsideBody(rule) : activeBody(rule, context),
    actions: [button(setAside ? 'Fix' : 'Edit', { onClick: () => openKeepAliveSheet(rule, context) })],
  }
}

function activeBody (rule: KeepAliveEntry, context: SectionContext): Node[] {
  return [
    element('div', { class: 'row__title' },
      activeControl(rule, context),
      element('span', { class: 'row__name' }, routeLabel(rule.proxyId)),
      isUsable(rule.proxyId) ? null : badge('unavailable'),
      rule.notices.length > 0 ? badge('ignored') : null,
    ),
    element('div', { class: 'mono' }, tabPatternSummary(rule)),
    element('div', { class: 'row__meta' }, `Test URL: ${rule.testUrl || defaults.testUrl}`),
    ...(rule.notices.length > 0 ? [element('p', { class: 'help' }, rule.notices.join(' '))] : []),
  ]
}

function setAsideBody (rule: KeepAliveEntry): Node[] {
  return [
    element('div', { class: 'row__title' },
      lockedSwitchText('Keep-alive rule'),
      element('span', { class: 'row__name' }, routeLabel(rule.proxyId)),
      badge('not-used'),
    ),
    element('div', { class: 'mono' }, tabPatternSummary(rule)),
    element('p', { class: 'help row__reason' }, icon('alert'), rule.faults.join(' ')),
  ]
}

function tabPatternSummary (rule: KeepAliveEntry): string {
  return rule.tabPatterns.join(', ') || '(no tab patterns)'
}

function activeControl (rule: KeepAliveEntry, context: SectionContext): Node {
  return switchControl(`Keep-alive for ${routeLabel(rule.proxyId)} active`, rule.active, checked => {
    rule.active = checked
    context.refresh('Saved')
  }, { focusKey: `active-${rule.id}` })
}
