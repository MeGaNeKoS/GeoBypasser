import { DIRECT_PROXY_ID } from '@constant/proxy'
import type { ProxyTestResult } from '@customTypes/proxy'
import type { NotInEffectState } from '@utils/controlNotice'
import { DIRECT_LABEL, navCounts, popupRules } from '@utils/pageView'
import { isRuleActive, usableProxies } from '@utils/usable'
import { isValidRule } from '@utils/validity'

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
  tabProxyId: string | undefined
  siteProxyId: string | undefined
  proxyList: unknown
  notInEffect: boolean
}

export function popupUsingLine (input: PopupUsingInput): string {
  const applied = appliedProxy(input)
  if (applied === undefined) return `No ${input.scope} proxy`
  const setting = `set for this ${applied.scope}`
  const label = proxyLabelFor(applied.proxyId, input.proxyList)
  if (label === undefined) return `Unavailable: ${applied.proxyId} (${setting})`
  return `${input.notInEffect ? 'Saved, not in effect' : 'Using'}: ${label} (${setting})`
}

function appliedProxy (input: PopupUsingInput): { scope: PopupScope; proxyId: string } | undefined {
  if (input.tabProxyId !== undefined) return { scope: 'tab', proxyId: input.tabProxyId }
  if (input.siteProxyId !== undefined) return { scope: 'site', proxyId: input.siteProxyId }
  return undefined
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

export type PopupRuleRow = { position: number; name: string; active: boolean }

export function popupRuleRows (list: unknown, filter: RuleFilter): PopupRuleRow[] {
  if (!Array.isArray(list)) return []
  const wantActive = filter === 'active'
  return list.flatMap((rule: unknown, position) => {
    if (!isValidRule(rule) || isRuleActive(rule) !== wantActive) return []
    return [{ position, name: rule.name, active: wantActive }]
  })
}

export function emptyRuleListText (summary: PopupRuleSummary, filter: RuleFilter): string {
  if (summary.total === 0) return 'No rules yet.'
  return filter === 'active' ? 'No active rules' : 'No inactive rules'
}

export function hostForTabUrl (url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

export function needsFixingLine (needsFixing: number): string | null {
  if (needsFixing === 0) return null
  return needsFixing === 1 ? '1 rule needs fixing.' : `${needsFixing} rules need fixing.`
}

export type PopupWarning = { message: string; actionLabel?: string }

const OTHER_EXTENSION_WARNING: PopupWarning = {
  message: 'GeoBypass is not routing. Another extension controls proxy settings. Turn it off or remove it.',
  actionLabel: 'Open extensions page',
}

const POLICY_WARNING: PopupWarning = {
  message: 'GeoBypass is not routing. A browser policy controls proxy settings. GeoBypass cannot change it.',
}

export function popupControlWarning (state: NotInEffectState): PopupWarning {
  return state === 'overridden' ? OTHER_EXTENSION_WARNING : POLICY_WARNING
}

export function popupTestResultLine (result: ProxyTestResult): string {
  return result.success ? `Connected through ${result.proxy}` : `Failed: ${result.error}`
}

export function chromeSiteNote (domain: string): string {
  return `A site proxy covers requests to ${domain} and its subdomains, not other hosts the page loads from.`
}

export const FIREFOX_ONLY_NOTE = 'Per tab proxies and Test proxy here are Firefox only.'
