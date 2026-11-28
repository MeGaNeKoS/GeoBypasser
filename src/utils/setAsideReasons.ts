import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import { ruleFormFaults } from '@utils/ruleFaults'
import { proxyFormFaults, proxyFormOf, storedProxyOf } from '@utils/proxyDraft'
import { ruleFormOf, storedRuleOf } from '@utils/ruleDraft'
import { isBareHostname, isValidFailoverTimeout, isValidProxyId, isValidStaticExtensions, isValidTestUrl, validateHostnamePattern } from '@utils/validity'

const PROXY_ID_FAULT = 'This proxy has no internal id, so rules and sites cannot use it. Open Fix and save to repair it.'
const FAILOVER_TIMEOUT_IGNORED_NOTE = 'Failover timeout is not a whole number of seconds, 1 or more, so the default is used.'
const STATIC_EXTENSIONS_IGNORED_NOTE = "'Never proxy files matching' is not a valid pattern, so it is ignored. The rule still works."
const OVERRIDE_DOMAIN_FAULT = 'Domain is not a valid host name, such as example.com.'
const OVERRIDE_PROXY_FAULT = 'No proxy is chosen for this site.'
const KEEP_ALIVE_NO_TAB_URL_FAULT = 'Add at least one tab URL pattern.'
const KEEP_ALIVE_ACTIVE_FAULT = 'Choose on or off.'
const KEEP_ALIVE_TEST_URL_IGNORED_NOTE = 'Test URL is not valid, so the default test URL is used.'

const PROXY_FIELD_STATEMENTS: Record<string, string> = {
  type: 'Type is not HTTP or SOCKS5.',
  host: 'Host is missing.',
  port: 'Port is not a number from 1 to 65535.',
  failoverTimeout: FAILOVER_TIMEOUT_IGNORED_NOTE,
}

export function proxyReasons (entry: unknown): string[] {
  const proxy = storedProxyOf(entry)
  const idFaults = isValidProxyId(proxy?.id) ? [] : [PROXY_ID_FAULT]
  return [...idFaults, ...proxyFormFaults(proxyFormOf(proxy)).map(fault => PROXY_FIELD_STATEMENTS[fault.field] ?? fault.message)]
}

export function ruleReasons (entry: unknown): string[] {
  const rule = storedRuleOf(entry)
  const formFaults = ruleFormFaults(ruleFormOf(rule)).map(fault => fault.message)
  return [...formFaults, ...unknownResourceTypesOf(entry).map(type => `Unknown resource type: ${type}.`)]
}

export function unknownResourceTypesOf (entry: unknown): string[] {
  const rule = storedRuleOf(entry)
  const types = new Set([...listOf(rule?.bypassResourceTypes), ...listOf(rule?.proxyOnlyResourceTypes)])
  return [...types]
    .filter(type => !WEB_REQUEST_RESOURCE_TYPES.some(known => known === type))
    .map(String)
}

function listOf (value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function failoverTimeoutIgnoredNote (entry: unknown): string | undefined {
  const timeout = storedProxyOf(entry)?.failoverTimeout
  return timeout !== undefined && !isValidFailoverTimeout(timeout) ? FAILOVER_TIMEOUT_IGNORED_NOTE : undefined
}

export function staticExtensionsIgnoredNote (entry: unknown): string | undefined {
  const value = storedRuleOf(entry)?.staticExtensions
  return value !== undefined && !isValidStaticExtensions(value) ? STATIC_EXTENSIONS_IGNORED_NOTE : undefined
}

export function overrideReasons (domain: string, proxyId: unknown): string[] {
  return [
    ...(isBareHostname(domain) ? [] : [OVERRIDE_DOMAIN_FAULT]),
    ...(typeof proxyId === 'string' && proxyId !== '' ? [] : [OVERRIDE_PROXY_FAULT]),
  ]
}

export function keepAliveReasons (entry: unknown): string[] {
  const rule = recordOf(entry)
  const tabUrls = Array.isArray(rule.tabUrls) ? rule.tabUrls : []
  return [
    ...(tabUrls.length > 0 ? [] : [KEEP_ALIVE_NO_TAB_URL_FAULT]),
    ...tabUrls
      .map((url, index) => ({ url, index }))
      .filter(({ url }) => typeof url !== 'string' || !validateHostnamePattern(url))
      .map(({ index }) => `Tab URL pattern ${index + 1} is not valid.`),
    ...(typeof rule.active === 'boolean' ? [] : [KEEP_ALIVE_ACTIVE_FAULT]),
  ]
}

export function keepAliveTestUrlIgnoredNote (entry: unknown): string | undefined {
  const url = recordOf(entry).testProxyUrl
  return url !== undefined && !isValidTestUrl(url) ? KEEP_ALIVE_TEST_URL_IGNORED_NOTE : undefined
}

function recordOf (value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
