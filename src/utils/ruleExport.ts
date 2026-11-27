import { DIRECT_PROXY_ID } from '@constant/proxy'
import { isRuleShownInvalid } from '@utils/validity'

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function exportedRule (entry: unknown, keepProxyId: boolean): Record<string, unknown> | undefined {
  if (!isRecord(entry)) return undefined
  if (isRuleShownInvalid(entry)) return entry
  return {
    active: entry.active === undefined ? true : entry.active,
    proxyId: keepProxyId ? entry.proxyId : DIRECT_PROXY_ID,
    name: entry.name,
    match: entry.match,
    bypassUrlPatterns: entry.bypassUrlPatterns,
    bypassResourceTypes: entry.bypassResourceTypes,
    proxyOnlyResourceTypes: entry.proxyOnlyResourceTypes,
    proxyOnlyPageHostnames: entry.proxyOnlyPageHostnames,
    staticExtensions: entry.staticExtensions,
    forceProxyUrlPatterns: entry.forceProxyUrlPatterns,
    fallbackDirect: entry.fallbackDirect,
  }
}

export function exportedRules (entries: unknown[], keepProxyId: (proxyId: unknown) => boolean): Record<string, unknown>[] {
  return entries.flatMap(entry => {
    const rule = exportedRule(entry, isRecord(entry) && keepProxyId(entry.proxyId))
    return rule ? [rule] : []
  })
}
