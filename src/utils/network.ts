export type NetworkStatsNode = {
  sent: number
  received: number
  children?: Record<string, NetworkStatsNode>
}

export type NetworkStats = {
  total: NetworkStatsNode
  domains: Record<string, NetworkStatsNode>
}

export const networkStats: NetworkStats = {
  total: { sent: 0, received: 0, children: {} },
  domains: {}
}

export function formatBytes (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`
}

function ensureChild(parent: Record<string, NetworkStatsNode>, key: string): NetworkStatsNode {
  if (!parent[key]) parent[key] = { sent: 0, received: 0, children: {} }
  return parent[key]
}

export function addNetworkData(url: string, sent: number, received: number) {
  if (sent === 0 && received === 0) return
  try {
    const u = new URL(url)
    const segments = u.pathname.split('/').filter(Boolean)
    const first = segments[0] || '/'
    const second = segments[1]

    networkStats.total.sent += sent
    networkStats.total.received += received

    const domainNode = ensureChild(networkStats.domains, u.hostname)
    domainNode.sent += sent
    domainNode.received += received

    const firstNode = ensureChild(domainNode.children!, first)
    firstNode.sent += sent
    firstNode.received += received

    if (second) {
      const secondNode = ensureChild(firstNode.children!, second)
      secondNode.sent += sent
      secondNode.received += received
    }
  } catch {
    // ignore invalid urls
  }
}

export function resetNetworkStats() {
  networkStats.total.sent = 0
  networkStats.total.received = 0
  for (const k of Object.keys(networkStats.domains)) delete networkStats.domains[k]
}
