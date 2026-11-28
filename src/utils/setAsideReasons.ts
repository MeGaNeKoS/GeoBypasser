import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import { ruleFormFaults } from '@utils/ruleFaults'
import { proxyFormFaults, proxyFormOf, storedProxyOf } from '@utils/proxyDraft'
import { ruleFormOf, storedRuleOf } from '@utils/ruleDraft'
import { isValidFailoverTimeout, isValidProxyId, isValidStaticExtensions } from '@utils/validity'

const PROXY_ID_FAULT = 'This proxy has no internal id, so rules and sites cannot use it. Open Fix and save to repair it.'
const FAILOVER_TIMEOUT_IGNORED_NOTE = 'Failover timeout is not a whole number of seconds, 1 or more, so the default is used.'
const STATIC_EXTENSIONS_IGNORED_NOTE = 'Static extensions is not a valid pattern, so it is ignored. The rule still works.'

const PROXY_FIELD_STATEMENTS: Record<string, string> = {
  type: 'Type is not HTTP or SOCKS5.',
  host: 'Host is missing.',
  port: 'Port is not valid.',
  failoverTimeout: 'Failover timeout is not valid.',
}

export function proxyReasons (entry: unknown): string[] {
  const proxy = storedProxyOf(entry)
  const idFaults = isValidProxyId(proxy?.id) ? [] : [PROXY_ID_FAULT]
  return [...idFaults, ...proxyFormFaults(proxyFormOf(proxy)).map(fault => PROXY_FIELD_STATEMENTS[fault.field] ?? fault.message)]
}

export function ruleReasons (entry: unknown): string[] {
  const rule = storedRuleOf(entry)
  const formFaults = ruleFormFaults(ruleFormOf(rule)).map(fault => fault.message)
  return [...formFaults, ...unknownResourceTypeReasons(rule)]
}

function unknownResourceTypeReasons (rule: Record<string, unknown> | undefined): string[] {
  const types = new Set([...listOf(rule?.bypassResourceTypes), ...listOf(rule?.proxyOnlyResourceTypes)])
  return [...types]
    .filter(type => !WEB_REQUEST_RESOURCE_TYPES.some(known => known === type))
    .map(type => `Unknown resource type: ${String(type)}.`)
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
