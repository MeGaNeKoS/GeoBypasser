import { DIRECT_ID, type ProxyEntry } from './model'
import { proxies } from './sample-data'

export function usableProxies (): ProxyEntry[] {
  return proxies.filter(proxy => proxy.faults.length === 0)
}

export function findProxy (id: string): ProxyEntry | undefined {
  return proxies.find(proxy => proxy.id === id)
}

export function isUsable (id: string): boolean {
  return id === DIRECT_ID || usableProxies().some(proxy => proxy.id === id)
}

export function routeLabel (id: string): string {
  if (id === DIRECT_ID) return 'Direct'
  const proxy = findProxy(id)
  if (!proxy) return `${id.slice(0, 4)}…`
  return proxy.label || 'No label'
}

export function proxyAddress (proxy: ProxyEntry): string {
  return `${proxy.host}:${proxy.port}`
}
