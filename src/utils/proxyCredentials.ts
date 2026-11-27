import type { ProxyListItem } from '@customTypes/proxy'
import { isValidProxyItem } from '@utils/validity'

export type CredentialsOption = 'omit' | 'include'

export function exportProxyList<T> (list: T[], credentials: CredentialsOption): T[] {
  return credentials === 'include' ? list : list.map(withoutCredentials)
}

export function keepStoredCredentials (imported: ProxyListItem[], stored: unknown[]): ProxyListItem[] {
  const storedById = new Map(stored.filter(isValidProxyItem).map(proxy => [proxy.id, proxy] as const))
  return imported.map(proxy => {
    const kept = storedById.get(proxy.id)
    if (!kept || hasCredentials(proxy)) return proxy
    return withCredentialsOf(proxy, kept)
  })
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasCredentials (proxy: ProxyListItem) {
  return Boolean(proxy.username || proxy.password)
}

function withoutCredentials<T> (entry: T): T {
  if (!isRecord(entry)) return entry
  const exported: Record<string, unknown> = { ...entry }
  delete exported.username
  delete exported.password
  return exported as T
}

function withCredentialsOf (proxy: ProxyListItem, source: ProxyListItem): ProxyListItem {
  const merged = { ...proxy }
  if (source.username !== undefined) merged.username = source.username
  if (source.password !== undefined) merged.password = source.password
  return merged
}
