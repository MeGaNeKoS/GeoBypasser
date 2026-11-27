import { element } from '@ui/dom'
import { icon } from '@ui/icons'
import { button, linkButton } from '@ui/components/button'
import { switchControl, lockedSwitchText } from '@ui/components/controls'
import { badge } from '@ui/components/feedback'
import { faultBanner, FaultFilter, nothingLeftToFix } from '../components/fault-filter'
import { listSection, type EmptyState, type ListRow } from '@ui/components/list-section'
import { removeIds } from '../collections'
import { isUsable, routeLabel, usableProxies } from '../proxy-lookup'
import type { RuleEntry } from '../model'
import { rules } from '../sample-data'
import { openRuleSheet } from '../sheets/rule-sheet'
import { openReviewSheet } from '../sheets/review-sheet'
import { openChooseFilesSheet } from '../sheets/choose-files-sheet'
import { exportNotice } from './export-notice'
import type { SectionContext } from './section-context'

const MISSING_PROXY_REASON = 'Its proxy is missing or invalid.'
const RULE_NOUNS = { noun: 'rule', nounPlural: 'rules' }
const faultFilter = new FaultFilter()

export function rulesSection (context: SectionContext): HTMLElement {
  const state = context.store.get().listState
  const faulty = rules.filter(rule => rule.faults.length > 0)
  const entries = state === 'populated' ? faultFilter.visible(rules, rule => rule.faults.length > 0) : []
  const refresh = (): void => context.refresh()
  return listSection({
    title: 'Rules',
    help: 'Rules send matching requests through a proxy you choose.',
    noun: 'rule',
    nounPlural: 'rules',
    addLabel: '+ Add rule',
    state,
    rows: entries.map(rule => ruleRow(rule, context)),
    empty: faultFilter.isShowingOnly() ? nothingLeftToFix(faultFilter, RULE_NOUNS, refresh) : emptyState(context),
    banners: faulty.length > 0 ? [faultBanner(faultFilter, faulty.length, RULE_NOUNS, refresh)] : [],
    onAdd: () => openRuleSheet(null, context),
    onImport: () => openReviewSheet(context),
    onRetry: () => context.refresh(),
    onRemove: ids => {
      removeIds(rules, ids)
      context.refresh(`Deleted ${ids.length} ${ids.length === 1 ? 'rule' : 'rules'}`)
    },
    onExport: ids => exportNotice(ids.length, 'rule'),
  })
}

function emptyState (context: SectionContext): EmptyState {
  const noProxies = usableProxies().length === 0
  return {
    title: 'No rules yet',
    text: noProxies ? 'A rule sends matching requests through a proxy you choose. Add a proxy first, or route a rule to Direct.' : 'A rule sends matching requests through a proxy you choose.',
    actions: [
      button('+ Add rule', { variant: 'primary', onClick: () => openRuleSheet(null, context) }),
      button('Import rules', { onClick: () => openReviewSheet(context) }),
      button('Browse community rules', { onClick: () => openChooseFilesSheet(context, 'community') }),
      ...(noProxies ? [linkButton('Go to Proxies', () => { window.location.hash = 'proxies' })] : []),
    ],
  }
}

function ruleRow (rule: RuleEntry, context: SectionContext): ListRow {
  const setAside = rule.faults.length > 0
  return {
    id: rule.id,
    name: rule.name || 'no name',
    setAside,
    body: setAside ? setAsideBody(rule) : ruleBody(rule, context),
    actions: [
      button(setAside ? 'Fix' : 'Edit', { onClick: () => openRuleSheet(rule, context) }),
      button('Export', { onClick: () => context.refresh(exportNotice(1, 'rule')) }),
    ],
  }
}

function ruleBody (rule: RuleEntry, context: SectionContext): Node[] {
  return [
    element('div', { class: 'row__title' }, activeControl(rule, context),
      element('span', { class: 'row__name' }, rule.name || '(no name)'),
      element('span', { class: 'row__meta' }, `via ${routeLabel(rule.proxyId)}`),
      isUsable(rule.proxyId) ? null : badge('unavailable'),
      rule.notices.length > 0 ? badge('ignored') : null,
    ),
    element('div', { class: 'mono' }, patternSummary(rule)),
    ...(isUsable(rule.proxyId) ? [] : [element('p', { class: 'help row__reason' }, icon('alert'), MISSING_PROXY_REASON)]),
    ...(rule.notices.length > 0 ? [element('p', { class: 'help' }, rule.notices.join(' '))] : []),
  ]
}

function setAsideBody (rule: RuleEntry): Node[] {
  return [
    element('div', { class: 'row__title' }, lockedSwitchText('Rule'),
      element('span', { class: 'row__name' }, rule.name || '(no name)'),
      badge('not-used'),
    ),
    element('div', { class: 'mono' }, rule.matchPatterns.join(', ') || '(missing)'),
    element('p', { class: 'help row__reason' }, icon('alert'), rule.faults.join(' ')),
  ]
}

function activeControl (rule: RuleEntry, context: SectionContext): Node {
  return switchControl(`Rule ${rule.name} active`, rule.active, checked => {
    rule.active = checked
    context.refresh('Saved')
  }, { focusKey: `active-${rule.id}` })
}

function patternSummary (rule: RuleEntry): string {
  const [first, ...others] = rule.matchPatterns
  if (!first) return '(no match patterns)'
  return others.length === 0 ? first : `${first}  +${others.length} more`
}
