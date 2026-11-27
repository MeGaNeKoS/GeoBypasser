import { usableProxies } from '@utils/usable'
import {
  isValidKeepAliveRule,
  isValidOverrideEntry,
  isValidProxyHost,
  isValidProxyItem,
  isValidProxyPort,
  isValidProxyType,
  isValidRule,
  isValidStaticExtensions,
  isValidTestUrl,
} from '@utils/validity'

export function canSaveProxy (proxy: unknown): boolean {
  return isValidProxyItem(proxy)
}

export function proxyFieldsAtFault (proxy: Record<'type' | 'host' | 'port', unknown>) {
  return {
    type: !isValidProxyType(proxy.type),
    host: !isValidProxyHost(proxy.host),
    port: !isValidProxyPort(proxy.port),
  }
}

export function canSaveRuleForm (rule: unknown): boolean {
  return isValidRule(rule) && isValidStaticExtensions((rule as { staticExtensions?: unknown }).staticExtensions)
}

export function canToggleRule (rule: unknown): boolean {
  return isValidRule(rule)
}

export function canSaveOverride (domain: string, proxyId: unknown): boolean {
  return isValidOverrideEntry(domain, proxyId)
}

export function canSaveKeepAliveRule (rule: unknown): boolean {
  if (!isValidKeepAliveRule(rule)) return false
  const { testProxyUrl } = rule as { testProxyUrl?: unknown }
  return testProxyUrl === undefined || isValidTestUrl(testProxyUrl)
}

export function canSaveTestUrl (url: unknown): boolean {
  return isValidTestUrl(url)
}

export function canSaveDefaultProxy (proxyId: unknown, proxyList: unknown): boolean {
  return proxyId === '' || usableProxies(proxyList).some(proxy => proxy.id === proxyId)
}
