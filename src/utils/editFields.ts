import { isRuleActive } from '@utils/usable'

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textOf (value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function listText (value: unknown): string {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string').join(', ') : ''
}

function portText (value: unknown): string {
  return typeof value === 'number' ? String(value) : ''
}

export function proxyFormValues (entry: unknown) {
  const proxy = isRecord(entry) ? entry : {}
  return {
    label: textOf(proxy.label),
    type: textOf(proxy.type),
    host: textOf(proxy.host),
    port: portText(proxy.port),
    username: textOf(proxy.username),
    password: textOf(proxy.password),
    notifyIfDown: proxy.notifyIfDown === true,
  }
}

export function ruleFormValues (entry: unknown) {
  const rule = isRecord(entry) ? entry : {}
  return {
    name: textOf(rule.name),
    match: listText(rule.match),
    proxyId: textOf(rule.proxyId),
    bypassUrlPatterns: listText(rule.bypassUrlPatterns),
    bypassResourceTypes: listText(rule.bypassResourceTypes),
    staticExtensions: textOf(rule.staticExtensions),
    forceProxyUrlPatterns: listText(rule.forceProxyUrlPatterns),
    fallbackDirect: rule.fallbackDirect === true,
    active: isRuleActive({ active: rule.active }),
  }
}
