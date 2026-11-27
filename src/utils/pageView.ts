import { DIRECT_PROXY_ID } from '@constant/proxy'
import type { KeepAliveProxyRule, ProxyRule } from '@customTypes/proxy'
import { isProxyShownInvalid, isRuleShownInvalid } from '@utils/validity'
import { isRuleActive, usableKeepAliveRules, usableOverrides, usableProxies, usableRules } from '@utils/usable'

type Entry = Record<string, any>

function asEntry (value: unknown): Entry {
  return typeof value === 'object' && value !== null ? value as Entry : {}
}

function asText (value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

export function proxyRows (list: unknown, isRevealed: (index: number) => boolean = () => false) {
  const items = Array.isArray(list) ? list : []
  return items.map((value, index) => {
    const proxy = asEntry(value)
    return {
      index,
      invalid: isProxyShownInvalid(value),
      entry: proxy,
      label: asText(proxy.label || proxy.host),
      type: proxy.type === 'socks' ? 'socks5' : asText(proxy.type),
      host: asText(proxy.host),
      port: asText(proxy.port),
      username: asText(proxy.username),
      hasPassword: !!proxy.password,
      password: proxy.password ? (isRevealed(index) ? asText(proxy.password) : '******') : '',
      notifyIfDown: !!proxy.notifyIfDown,
    }
  })
}

export function ruleRows (list: unknown, proxyList: unknown) {
  const items = Array.isArray(list) ? list : []
  const proxies = usableProxies(proxyList)
  return items.map((value, index) => {
    const rule = asEntry(value)
    const proxy = proxies.find(p => p.id === rule.proxyId)
    return {
      index,
      invalid: isRuleShownInvalid(value),
      rule,
      active: isRuleActive(rule),
      name: asText(rule.name),
      match: Array.isArray(rule.match) ? rule.match.join(', ') : '',
      proxyLabel: rule.proxyId === DIRECT_PROXY_ID
        ? 'Direct'
        : proxy ? asText(proxy.label || proxy.host) : asText(rule.proxyId),
      missingProxy: !proxy,
    }
  })
}

export function overrideRows (map: unknown, proxyList: unknown) {
  const proxies = usableProxies(proxyList)
  return Object.entries(usableOverrides(map)).map(([domain, proxyId]) => {
    const proxy = proxies.find(p => p.id === proxyId)
    return {
      domain,
      proxyLabel: proxy ? asText(proxy.label || proxy.host) : proxyId,
    }
  })
}

export function keepAliveRows (map: unknown, proxyList: unknown) {
  const proxies = usableProxies(proxyList)
  const raw = map as Record<string, KeepAliveProxyRule[string]>
  return Object.entries(usableKeepAliveRules(map)).map(([proxyId, rule]) => {
    const proxy = proxies.find(p => p.id === proxyId)
    return {
      proxyId,
      raw: raw[proxyId],
      active: rule.active,
      tabUrls: rule.tabUrls.join(', '),
      testProxyUrl: rule.testProxyUrl || '',
      proxyLabel: proxy ? asText(proxy.label || proxy.host) : proxyId,
      missingProxy: !proxy,
    }
  })
}

export function proxyOptions (list: unknown) {
  return usableProxies(list)
}

export function popupRules (list: unknown, showActive: boolean): ProxyRule[] {
  return usableRules(list).filter(rule => isRuleActive(rule) === showActive)
}

export type SetAsideSource = {
  proxyList?: unknown
  rules?: unknown
  perWebsiteOverride?: unknown
  keepAliveRules?: unknown
}

export type SetAsideCounts = {
  proxies: number
  rules: number
  sites: number
  keepAlive: number
}

export function setAsideCounts (source: SetAsideSource): SetAsideCounts {
  return {
    proxies: countEntries(source.proxyList) - usableProxies(source.proxyList).length,
    rules: countEntries(source.rules) - usableRules(source.rules).length,
    sites: countEntries(source.perWebsiteOverride) - Object.keys(usableOverrides(source.perWebsiteOverride)).length,
    keepAlive: countEntries(source.keepAliveRules) - Object.keys(usableKeepAliveRules(source.keepAliveRules)).length,
  }
}

export type NavCount = { count: number; needsFixing: number }

export type NavCounts = {
  proxies: NavCount
  rules: NavCount
  sites: NavCount
  keepAlive: NavCount
}

export function navCounts (source: SetAsideSource): NavCounts {
  const setAside = setAsideCounts(source)
  return {
    proxies: { count: usableProxies(source.proxyList).length, needsFixing: setAside.proxies },
    rules: { count: usableRules(source.rules).length, needsFixing: setAside.rules },
    sites: { count: Object.keys(usableOverrides(source.perWebsiteOverride)).length, needsFixing: setAside.sites },
    keepAlive: { count: Object.keys(usableKeepAliveRules(source.keepAliveRules)).length, needsFixing: setAside.keepAlive },
  }
}

function countEntries (value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object' && value !== null) return Object.keys(value).length
  return 0
}
