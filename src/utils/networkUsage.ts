import { formatBytes } from './network'
import type { NetworkStatsNode } from './network'

export type UsageRow = {
  name: string
  sent: string
  received: string
  children: UsageRow[]
}

export function usageRows (nodes: Record<string, NetworkStatsNode>): UsageRow[] {
  return Object.entries(nodes)
    .filter(([, node]) => carriesTraffic(node))
    .map(([name, node]) => ({
      name,
      sent: formatBytes(node.sent),
      received: formatBytes(node.received),
      children: usageRows(node.children ?? {}),
    }))
}

function carriesTraffic (node: NetworkStatsNode): boolean {
  return node.sent !== 0 || node.received !== 0
}
