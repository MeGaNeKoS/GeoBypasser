import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import { ruleFormFaults } from '@utils/ruleFaults'
import { proxyFormFaults, proxyFormOf, storedProxyOf } from '@utils/proxyDraft'
import { ruleFormOf, storedRuleOf } from '@utils/ruleDraft'
import { isValidFailoverTimeout, isValidProxyId, isValidStaticExtensions } from '@utils/validity'

const PROXY_ID_FAULT = 'The proxy has no id, so rules cannot use it.'
const FAILOVER_TIMEOUT_IGNORED_NOTE = 'Failover timeout is not a number, so the default is used.'
const STATIC_EXTENSIONS_IGNORED_NOTE = 'Static extensions is not a valid pattern, so it is ignored. The rule still works.'

export function proxyReasons (entry: unknown): string[] {
  const proxy = storedProxyOf(entry)
  const idFaults = isValidProxyId(proxy?.id) ? [] : [PROXY_ID_FAULT]
  return [...idFaults, ...proxyFormFaults(proxyFormOf(proxy)).map(fault => fault.message)]
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
