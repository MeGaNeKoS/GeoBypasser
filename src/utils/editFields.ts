import type { KeepAliveProxyRule, ProxyListItem, ProxyRule } from '@customTypes/proxy'

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textOf (value: unknown): string {
  return typeof value === 'string' ? value : ''
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

export const RULE_FORM_FIELDS: readonly (keyof ProxyRule)[] = [
  'name', 'match', 'proxyId', 'active', 'bypassUrlPatterns', 'bypassResourceTypes',
  'proxyOnlyResourceTypes', 'proxyOnlyPageHostnames', 'staticExtensions', 'forceProxyUrlPatterns', 'fallbackDirect',
]

export const PROXY_FORM_FIELDS: readonly (keyof ProxyListItem)[] = [
  'id', 'type', 'host', 'port', 'proxyDNS', 'label', 'username', 'password', 'notifyIfDown',
]

type KeepAliveEntry = KeepAliveProxyRule[string]

export const KEEP_ALIVE_FORM_FIELDS: readonly (keyof KeepAliveEntry)[] = [
  'active', 'tabUrls', 'testProxyUrl',
]

export function mergeEditedFields<T extends object> (
  stored: T | undefined,
  edited: T,
  editedKeys: readonly (keyof T)[],
): T {
  const kept: Partial<T> = { ...stored }
  for (const key of editedKeys) delete kept[key]
  return { ...kept, ...edited } as T
}
