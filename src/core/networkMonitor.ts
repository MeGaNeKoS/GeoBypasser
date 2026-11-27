import type { NetworkMessage } from '@customTypes/messages'
import { addNetworkData, networkStats, resetNetworkStats } from '@utils/network'

type TransferSizes = { sentBytes: number; receivedBytes: number }

export function createNetworkMonitor () {
  const monitoredTabs = new Set<number>()

  function isTabMonitored (tabId: number) {
    return monitoredTabs.has(tabId)
  }

  function forgetTab (tabId: number) {
    monitoredTabs.delete(tabId)
  }

  function recordTransfer (tabId: number, url: string, sizes: TransferSizes) {
    if (!monitoredTabs.has(tabId)) return
    addNetworkData(url, sizes.sentBytes, sizes.receivedBytes)
  }

  function answerNetworkMessage (message: NetworkMessage): unknown {
    switch (message.type) {
      case 'getNetworkStats':
        return networkStats
      case 'clearNetworkStats':
        resetNetworkStats()
        return undefined
      case 'monitorTabNetwork':
        monitoredTabs.add(message.tabId)
        return undefined
      case 'unmonitorTabNetwork':
        monitoredTabs.delete(message.tabId)
        return undefined
      case 'isTabNetworkMonitored':
        return monitoredTabs.has(message.tabId)
      case 'devtoolsNetworkData':
        recordTransfer(message.tabId, message.url, {
          sentBytes: message.sentSize,
          receivedBytes: message.receivedSize,
        })
        return undefined
    }
  }

  return { isTabMonitored, forgetTab, recordTransfer, answerNetworkMessage }
}

export type NetworkMonitor = ReturnType<typeof createNetworkMonitor>
