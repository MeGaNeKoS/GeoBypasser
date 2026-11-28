import { DIRECT_PROXY_ID } from '@constant/proxy'
import type { ProxyRule } from '@customTypes/proxy'
import { isProxyShownInvalid, isRuleShownInvalid, isValidKeepAliveRule, isValidOverrideEntry } from '@utils/validity'
import { isRuleActive, usableKeepAliveRules, usableOverrides, usableProxies, usableRules } from '@utils/usable'
import {
  failoverTimeoutIgnoredNote,
  keepAliveReasons,
  keepAliveTestUrlIgnoredNote,
  overrideReasons,
  proxyReasons,
  ruleReasons,
  staticExtensionsIgnoredNote,
} from '@utils/setAsideReasons'

type Entry = Record<string, any>

const MISSING_TEXT = '(missing)'
const NO_LABEL_TEXT = '(no label)'

function asEntry (value: unknown): Entry {
  return typeof value === 'object' && value !== null ? value as Entry : {}
}

function asText (value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function asFieldText (value: unknown): string {
  return value === undefined || value === null || value === '' ? MISSING_TEXT : String(value)
}

function rawEntryText (value: unknown): string | undefined {
  return typeof value === 'object' || value === undefined ? undefined : String(value)
}

export function proxyRows (list: unknown, isRevealed: (index: number) => boolean = () => false) {
  const items = Array.isArray(list) ? list : []
  return items.map((value, index) => {
    const proxy = asEntry(value)
    const invalid = isProxyShownInvalid(value)
    return {
      index,
      invalid,
      faults: invalid ? proxyReasons(value) : [],
      rawEntry: rawEntryText(value),
      entry: proxy,
      label: asText(proxy.label || proxy.host) || NO_LABEL_TEXT,
      type: proxy.type === 'socks' ? 'socks5' : asFieldText(proxy.type),
      host: asFieldText(proxy.host),
      port: asFieldText(proxy.port),
      username: asText(proxy.username),
      hasPassword: !!proxy.password,
      password: proxy.password ? (isRevealed(index) ? asText(proxy.password) : '******') : '',
      notifyIfDown: !!proxy.notifyIfDown,
      ignoredNote: invalid ? undefined : failoverTimeoutIgnoredNote(value),
    }
  })
}

export function ruleRows (list: unknown, proxyList: unknown) {
  const items = Array.isArray(list) ? list : []
  const proxies = usableProxies(proxyList)
  return items.map((value, index) => {
    const rule = asEntry(value)
    const proxy = proxies.find(p => p.id === rule.proxyId)
    const invalid = isRuleShownInvalid(value)
    return {
      index,
      invalid,
      faults: invalid ? ruleReasons(value) : [],
      ignoredNote: invalid ? undefined : staticExtensionsIgnoredNote(value),
      rawEntry: rawEntryText(value),
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
  return Object.entries(asEntry(map)).map(([domain, proxyId]) => {
    const proxy = proxies.find(p => p.id === proxyId)
    const invalid = !isValidOverrideEntry(domain, proxyId)
    return {
      domain,
      invalid,
      faults: invalid ? overrideReasons(domain, proxyId) : [],
      rawEntry: rawEntryText(proxyId),
      proxyLabel: proxy ? asText(proxy.label || proxy.host) : asText(proxyId),
      missingProxy: !proxy,
    }
  })
}

export function keepAliveRows (map: unknown, proxyList: unknown) {
  const proxies = usableProxies(proxyList)
  return Object.entries(asEntry(map)).map(([proxyId, value]) => {
    const rule = asEntry(value)
    const proxy = proxies.find(p => p.id === proxyId)
    const invalid = !isValidKeepAliveRule(value)
    return {
      proxyId,
      raw: value,
      invalid,
      faults: invalid ? keepAliveReasons(value) : [],
      ignoredNote: invalid ? undefined : keepAliveTestUrlIgnoredNote(value),
      rawEntry: rawEntryText(value),
      active: rule.active === true,
      tabUrls: Array.isArray(rule.tabUrls) ? rule.tabUrls.map(asText).join(', ') : '',
      testProxyUrl: asText(rule.testProxyUrl),
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
    proxies: { count: countEntries(source.proxyList), needsFixing: setAside.proxies },
    rules: { count: countEntries(source.rules), needsFixing: setAside.rules },
    sites: { count: countEntries(source.perWebsiteOverride), needsFixing: setAside.sites },
    keepAlive: { count: countEntries(source.keepAliveRules), needsFixing: setAside.keepAlive },
  }
}

function countEntries (value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object' && value !== null) return Object.keys(value).length
  return 0
}
