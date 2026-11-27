import { element } from '@ui/dom'
import { icon } from '@ui/icons'
import { button, linkButton } from '@ui/components/button'
import { switchControl } from '@ui/components/controls'
import { badge } from '@ui/components/feedback'
import { faultBanner, FaultFilter, nothingLeftToFix } from '../components/fault-filter'
import { listSection, type ListRow } from '@ui/components/list-section'
import { removeIds } from '../collections'
import { proxyAddress } from '../proxy-lookup'
import type { ProxyEntry } from '../model'
import { keepAliveRules, proxies } from '../sample-data'
import { openKeepAliveSheet } from '../sheets/keep-alive-sheet'
import { openProxySheet } from '../sheets/proxy-sheet'
import { openReviewSheet } from '../sheets/review-sheet'
import { exportNotice } from './export-notice'
import type { SectionContext } from './section-context'

const revealedIds = new Set<string>()
const PROXY_NOUNS = { noun: 'proxy', nounPlural: 'proxies' }
const faultFilter = new FaultFilter()
let revealAll = false

export function resetPasswordReveal (): void {
  revealAll = false
  revealedIds.clear()
}

export function proxiesSection (context: SectionContext): HTMLElement {
  const state = context.store.get().listState
  const faulty = proxies.filter(isSetAside)
  const entries = state === 'populated' ? faultFilter.visible(proxies, isSetAside) : []
  const refresh = (): void => context.refresh()
  return listSection({
    title: 'Proxies',
    help: 'Servers your traffic can go through.',
    noun: 'proxy',
    nounPlural: 'proxies',
    addLabel: '+ Add proxy',
    state,
    rows: entries.map(entry => proxyRow(entry, context)),
    empty: faultFilter.isShowingOnly()
      ? nothingLeftToFix(faultFilter, PROXY_NOUNS, refresh)
      : {
        title: 'No proxies yet',
        text: 'Add a proxy to start routing traffic, or import a file.',
        actions: [
          button('+ Add proxy', { variant: 'primary', onClick: () => openProxySheet(null, context) }),
          button('Import proxies', { onClick: () => openReviewSheet(context) }),
        ],
      },
    banners: faulty.length > 0 ? [faultBanner(faultFilter, faulty.length, PROXY_NOUNS, refresh)] : [],
    toolbarExtras: [button(revealAll ? 'Hide all passwords' : 'Show all passwords', {
      onClick: () => {
        revealAll = !revealAll
        revealedIds.clear()
        context.refresh()
      },
    })],
    onAdd: () => openProxySheet(null, context),
    onImport: () => openReviewSheet(context),
    onRetry: () => context.refresh(),
    onRemove: ids => {
      removeIds(proxies, ids)
      context.refresh(`Deleted ${ids.length} ${ids.length === 1 ? 'proxy' : 'proxies'}`)
    },
    onExport: ids => exportNotice(ids.length, 'proxy', 'proxies'),
  })
}

function isSetAside (entry: ProxyEntry): boolean {
  return entry.faults.length > 0
}

function proxyRow (entry: ProxyEntry, context: SectionContext): ListRow {
  const setAside = isSetAside(entry)
  return {
    id: entry.id,
    name: entry.label || 'no label',
    setAside,
    body: setAside ? setAsideBody(entry) : proxyBody(entry, context),
    actions: [button(setAside ? 'Fix' : 'Edit', { onClick: () => openProxySheet(entry, context) })],
  }
}

function proxyBody (entry: ProxyEntry, context: SectionContext): Node[] {
  return [
    element('div', { class: 'row__title' },
      element('span', { class: 'row__name' }, entry.label || '(no label)'),
      element('span', { class: 'badge' }, typeLabel(entry)),
      element('span', { class: 'mono' }, proxyAddress(entry)),
      element('span', { class: 'row__meta' }, entry.username ? `user: ${entry.username}` : 'no sign in'),
      entry.notices.length > 0 ? badge('ignored') : null,
    ),
    element('div', { class: 'row__meta' },
      passwordControl(entry, context),
      element('span', {}, 'Notify if down'),
      switchControl(`Notify if down for ${entry.label || 'this proxy'}`, entry.notify, checked => {
        entry.notify = checked
        context.refresh('Saved')
      }, { focusKey: `notify-${entry.id}` }),
    ),
    ...(entry.notify && !hasKeepAliveRule(entry) ? [noRuleNote(entry, context)] : []),
    ...(entry.notices.length > 0 ? [element('p', { class: 'help' }, entry.notices.join(' '))] : []),
  ]
}

function passwordControl (entry: ProxyEntry, context: SectionContext): Node | null {
  if (entry.password === '') return null
  const shown = revealAll || revealedIds.has(entry.id)
  return element('span', { class: 'row__password' },
    element('span', { class: 'mono' }, shown ? entry.password : '******'),
    linkButton(shown ? 'Hide' : 'Show', () => {
      toggleReveal(entry.id)
      context.refresh()
    }, `reveal-${entry.id}`),
  )
}

function toggleReveal (id: string): void {
  if (revealedIds.has(id)) revealedIds.delete(id)
  else revealedIds.add(id)
}

function noRuleNote (entry: ProxyEntry, context: SectionContext): HTMLParagraphElement {
  return element('p', { class: 'help' },
    icon('info'),
    ' No keep-alive rule for this proxy, so no notices. ',
    linkButton('Add one', () => openKeepAliveSheet(null, context, entry.id), `add-keep-${entry.id}`),
  )
}

function setAsideBody (entry: ProxyEntry): Node[] {
  return [
    element('div', { class: 'row__title' },
      element('span', { class: 'row__name' }, entry.label || '(no label)'),
      element('span', { class: 'badge' }, typeLabel(entry)),
      badge('not-used'),
    ),
    element('div', { class: 'mono' }, `${entry.host || '(missing)'}:${entry.port || '(missing)'}`),
    element('p', { class: 'help row__reason' }, icon('alert'), entry.faults.join(' ')),
  ]
}

function hasKeepAliveRule (entry: ProxyEntry): boolean {
  return keepAliveRules.some(rule => rule.proxyId === entry.id)
}

function typeLabel (entry: ProxyEntry): string {
  return entry.type === 'http' ? 'HTTP' : 'SOCKS5'
}
