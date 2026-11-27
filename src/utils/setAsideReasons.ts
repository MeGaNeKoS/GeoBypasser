import { ruleFormFaults } from '@utils/ruleFaults'
import { proxyFormFaults, proxyFormOf, storedProxyOf } from '@utils/proxyDraft'
import { ruleFormOf, storedRuleOf } from '@utils/ruleDraft'
import { isValidProxyId, isValidStaticExtensions } from '@utils/validity'

const PROXY_ID_FAULT = 'The proxy has no id, so rules cannot use it.'
const STATIC_EXTENSIONS_IGNORED_NOTE = 'Static extensions is not a valid pattern, so it is ignored. The rule still works.'

export function proxyReasons (entry: unknown): string[] {
  const proxy = storedProxyOf(entry)
  const idFaults = isValidProxyId(proxy?.id) ? [] : [PROXY_ID_FAULT]
  return [...idFaults, ...proxyFormFaults(proxyFormOf(proxy)).map(fault => fault.message)]
}

export function ruleReasons (entry: unknown): string[] {
  return ruleFormFaults(ruleFormOf(storedRuleOf(entry))).map(fault => fault.message)
}

export function staticExtensionsIgnoredNote (entry: unknown): string | undefined {
  const value = storedRuleOf(entry)?.staticExtensions
  return value !== undefined && !isValidStaticExtensions(value) ? STATIC_EXTENSIONS_IGNORED_NOTE : undefined
}
