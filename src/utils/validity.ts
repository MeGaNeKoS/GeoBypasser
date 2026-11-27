import { matchPattern } from 'browser-extension-url-match'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { PROXY_TYPES } from '@constant/proxy'

const STATIC_EXTENSIONS_FORM = /^\/(.*)\/([gimsuy]*)$/

function isObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasForbiddenHostCharacter (host: string) {
  return [...host].some(char => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127 || /[\s;/\\"']/.test(char)
  })
}

export function isValidPattern (pattern: unknown): pattern is string {
  if (typeof pattern !== 'string') return false
  try {
    matchPattern(pattern, { strict: false }).assertValid()
    return true
  } catch {
    return false
  }
}

function isValidOptionalPatternList (list: unknown) {
  return list === undefined || (Array.isArray(list) && list.every(isValidPattern))
}

export function compileStaticExtensions (value: unknown): RegExp | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(STATIC_EXTENSIONS_FORM)
  if (!match) return undefined
  const flags = match[2]
  if (new Set(flags).size !== flags.length) return undefined
  try {
    return new RegExp(match[1], flags)
  } catch {
    return undefined
  }
}

export function isValidStaticExtensions (value: unknown): boolean {
  if (value === undefined || value === '') return true
  return compileStaticExtensions(value) !== undefined
}

export function isValidRule (rule: unknown): rule is ProxyRule {
  if (!isObject(rule)) return false
  const { name, match, proxyId, bypassUrlPatterns, forceProxyUrlPatterns } = rule
  return typeof name === 'string' && name.trim() !== '' &&
    Array.isArray(match) && match.length > 0 && match.every(isValidPattern) &&
    typeof proxyId === 'string' && proxyId !== '' &&
    isValidOptionalPatternList(bypassUrlPatterns) &&
    isValidOptionalPatternList(forceProxyUrlPatterns)
}

export function isValidProxyHost (host: unknown): boolean {
  if (typeof host !== 'string') return false
  const trimmed = host.trim()
  return trimmed !== '' && !hasForbiddenHostCharacter(trimmed)
}

export function isValidProxyPort (port: unknown): boolean {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

export function isValidProxyId (id: unknown): boolean {
  return typeof id === 'string' && id !== ''
}

export function isValidProxyType (type: unknown): boolean {
  return PROXY_TYPES.some(supported => supported === type)
}

export function isValidProxyItem (proxy: unknown): proxy is ProxyListItem {
  if (!isObject(proxy)) return false
  return isValidProxyId(proxy.id) && isValidProxyType(proxy.type) &&
    isValidProxyHost(proxy.host) && isValidProxyPort(proxy.port)
}

export function isValidTestUrl (url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function isRuleShownInvalid (rule: unknown): boolean {
  return !isValidRule(rule) || !isValidStaticExtensions((rule as ProxyRule).staticExtensions)
}

export function isProxyShownInvalid (proxy: unknown): boolean {
  return !isValidProxyItem(proxy)
}

function parseDomain (val: string) {
  let urlString = val.trim()

  // If there's no protocol, add one
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(urlString)) {
    urlString = 'https://' + urlString
  }

  return new URL(urlString)
}

export function isValidDomain (val: string): boolean {
  try {
    parseDomain(val)
    return true
  } catch {
    return false
  }
}

export function validateDomain (val: string) {
  try {
    parseDomain(val)
    return true
  } catch (e) {
    console.error('Invalid URL:', e)
    return false
  }
}

export function validateHostnamePattern (val: string) {
  const trimmed = val.trim()
  if (trimmed.startsWith('*.')) {
    const domain = trimmed.slice(2)
    return /^[a-zA-Z0-9.-]+$/.test(domain)
  }
  return /^[a-zA-Z0-9.-]+$/.test(trimmed)
}

export function isValidOverrideEntry (domain: string, proxyId: unknown): boolean {
  return isValidDomain(domain) && typeof proxyId === 'string' && proxyId !== ''
}

export function isValidKeepAliveRule (rule: unknown): boolean {
  if (!isObject(rule)) return false
  const { active, tabUrls } = rule
  return typeof active === 'boolean' && Array.isArray(tabUrls) &&
    tabUrls.every(url => typeof url === 'string' && validateHostnamePattern(url))
}
