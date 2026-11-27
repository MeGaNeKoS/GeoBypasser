import { matchPattern } from 'browser-extension-url-match'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { PROXY_TYPES } from '@constant/proxy'
import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'

const STATIC_EXTENSIONS_FORM = /^\/(.*)\/([gimsuy]*)$/
const BARE_HOSTNAME_FORM = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*\.?|\[[0-9a-f:.]+\])$/i

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

export function isValidOptionalHostnameList (list: unknown): boolean {
  return list === undefined ||
    (Array.isArray(list) && list.every(entry => typeof entry === 'string' && validateHostnamePattern(entry)))
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

export function isValidResourceTypes (list: unknown): boolean {
  return list === undefined || (Array.isArray(list) && list.every(type => WEB_REQUEST_RESOURCE_TYPES.some(known => known === type)))
}

export function isValidRule (rule: unknown): rule is ProxyRule {
  if (!isObject(rule)) return false
  const {
    name, match, proxyId, bypassUrlPatterns, forceProxyUrlPatterns, bypassResourceTypes,
    proxyOnlyResourceTypes, proxyOnlyPageHostnames,
  } = rule
  return typeof name === 'string' && name.trim() !== '' &&
    Array.isArray(match) && match.length > 0 && match.every(isValidPattern) &&
    typeof proxyId === 'string' && proxyId !== '' &&
    isValidOptionalPatternList(bypassUrlPatterns) &&
    isValidOptionalPatternList(forceProxyUrlPatterns) &&
    isValidResourceTypes(bypassResourceTypes) &&
    isValidResourceTypes(proxyOnlyResourceTypes) &&
    isValidOptionalHostnameList(proxyOnlyPageHostnames)
}

export function isValidProxyHost (host: unknown): boolean {
  if (typeof host !== 'string') return false
  const trimmed = host.trim()
  return trimmed !== '' && !hasForbiddenHostCharacter(trimmed)
}

export function isValidProxyPort (port: unknown): boolean {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

export function isValidProxyId (id: unknown): id is string {
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
  return !isValidRule(rule)
}

export function isProxyShownInvalid (proxy: unknown): boolean {
  return !isValidProxyItem(proxy)
}

function parseHostname (val: string): string | undefined {
  try {
    return new URL(`https://${val}/`).hostname
  } catch {
    return undefined
  }
}

export function isBareHostname (val: string): boolean {
  return BARE_HOSTNAME_FORM.test(val) && parseHostname(val) === val.toLowerCase()
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
  return isBareHostname(domain) && typeof proxyId === 'string' && proxyId !== ''
}

export function isValidKeepAliveRule (rule: unknown): boolean {
  if (!isObject(rule)) return false
  const { active, tabUrls } = rule
  return typeof active === 'boolean' && Array.isArray(tabUrls) && tabUrls.length > 0 &&
    tabUrls.every(url => typeof url === 'string' && validateHostnamePattern(url))
}
