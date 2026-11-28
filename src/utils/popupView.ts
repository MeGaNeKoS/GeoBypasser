import { DIRECT_PROXY_ID } from '@constant/proxy'
import { DIRECT_LABEL, navCounts, popupRules } from '@utils/pageView'
import { usableProxies } from '@utils/usable'

export type PopupScope = 'tab' | 'site'

export type PopupScopeOption = { scope: PopupScope; enabled: boolean }

export type RuleFilter = 'active' | 'inactive'

export type PopupRuleSummary = {
  total: number
  needsFixing: number
  active: number
  inactive: number
}

export function defaultPopupScope (supportsPerTabProxy: boolean): PopupScope {
  return supportsPerTabProxy ? 'tab' : 'site'
}

export function popupScopeOptions (supportsPerTabProxy: boolean): PopupScopeOption[] {
  return [
    { scope: 'tab', enabled: supportsPerTabProxy },
    { scope: 'site', enabled: true },
  ]
}

export function canTestFromPopup (supportsPerTabProxy: boolean): boolean {
  return supportsPerTabProxy
}

type PopupUsingInput = {
  scope: PopupScope
  proxyId: string | undefined
  proxyList: unknown
  notInEffect: boolean
}

export function popupUsingLine ({ scope, proxyId, proxyList, notInEffect }: PopupUsingInput): string {
  if (proxyId === undefined) return `No ${scope} proxy`
  const setting = `set for this ${scope}`
  const label = proxyLabelFor(proxyId, proxyList)
  if (label === undefined) return `Unavailable: ${proxyId} (${setting})`
  return `${notInEffect ? 'Saved, not in effect' : 'Using'}: ${label} (${setting})`
}

function proxyLabelFor (proxyId: string, proxyList: unknown): string | undefined {
  if (proxyId === DIRECT_PROXY_ID) return DIRECT_LABEL
  const proxy = usableProxies(proxyList).find(item => item.id === proxyId)
  return proxy ? proxy.label || proxy.host : undefined
}

export function popupRuleSummary (rules: unknown): PopupRuleSummary {
  const stored = navCounts({ rules }).rules
  return {
    total: stored.count,
    needsFixing: stored.needsFixing,
    active: popupRules(rules, true).length,
    inactive: popupRules(rules, false).length,
  }
}

export function emptyRuleListText (filter: RuleFilter): string {
  return filter === 'active' ? 'No active rules' : 'No inactive rules'
}

export function needsFixingLine (needsFixing: number): string | null {
  if (needsFixing === 0) return null
  return needsFixing === 1 ? '1 rule needs fixing.' : `${needsFixing} rules need fixing.`
}
