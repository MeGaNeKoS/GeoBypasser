import type { KeepAliveProxyRule, ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { isValidKeepAliveRule, isValidOverrideEntry, isValidProxyItem, isValidRule, isValidTestUrl } from '@utils/validity'

export function usableProxies (list: unknown): ProxyListItem[] {
  if (!Array.isArray(list)) return []
  return list.filter(isValidProxyItem).map(proxy => ({ ...proxy, host: proxy.host.trim() }))
}

export function isRuleActive (rule: { active?: unknown }): boolean {
  return rule.active === undefined || Boolean(rule.active)
}

export function usableRules<T extends ProxyRule = ProxyRule> (list: unknown): T[] {
  if (!Array.isArray(list)) return []
  return list.filter(isValidRule) as T[]
}

export function usableOverrides (map: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (typeof map !== 'object' || map === null) return result
  for (const [domain, proxyId] of Object.entries(map)) {
    if (isValidOverrideEntry(domain, proxyId)) result[domain] = proxyId as string
  }
  return result
}

export function usableKeepAliveRules (map: unknown): KeepAliveProxyRule {
  const result: KeepAliveProxyRule = {}
  if (typeof map !== 'object' || map === null) return result
  for (const [proxyId, rule] of Object.entries(map)) {
    if (!isValidKeepAliveRule(rule)) continue
    const { active, tabUrls, testProxyUrl } = rule as KeepAliveProxyRule[string]
    result[proxyId] = {
      active,
      tabUrls,
      testProxyUrl: isValidTestUrl(testProxyUrl) ? testProxyUrl : undefined,
    }
  }
  return result
}
