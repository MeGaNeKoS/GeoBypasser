import type { ProxyRule } from '@customTypes/proxy'
import { isValidPattern, isValidStaticExtensions } from '@utils/validity'

export function markInvalid (el: HTMLElement, invalid: boolean) {
  el.classList.toggle('invalid', invalid)
}

export function markRuleFieldsInvalid (rule: ProxyRule) {
  const field = (id: string) => document.getElementById(id) as HTMLElement
  markInvalid(field('ruleName'), !rule.name)
  markInvalid(field('ruleMatch'), rule.match.length === 0 || !rule.match.every(isValidPattern))
  markInvalid(field('ruleProxy'), !rule.proxyId)
  markInvalid(field('ruleBypassUrls'), !(rule.bypassUrlPatterns ?? []).every(isValidPattern))
  markInvalid(field('ruleForceUrls'), !(rule.forceProxyUrlPatterns ?? []).every(isValidPattern))
  markInvalid(field('ruleStaticExt'), !isValidStaticExtensions(rule.staticExtensions))
}
