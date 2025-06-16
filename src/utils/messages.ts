import { TabProxyMessage, NetworkMessage, MonitorNetworkMessage, UnmonitorNetworkMessage, IsMonitoredMessage } from '@customTypes/messages'

export function isTabProxyMessage (msg: unknown): msg is TabProxyMessage {
  if (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg
  ) {
    const type = (msg as { type?: unknown }).type
    if (type === 'setTabProxy') {
      return (
        'tabId' in msg &&
        typeof (msg as { tabId?: unknown }).tabId === 'number' &&
        'proxyId' in msg &&
        typeof (msg as { proxyId?: unknown }).proxyId === 'string'
      )
    }
    if (type === 'clearTabProxy') {
      return (
        'tabId' in msg &&
        typeof (msg as { tabId?: unknown }).tabId === 'number'
      )
    }
  }
  return false
}

export function isNetworkMessage (msg: unknown): msg is NetworkMessage {
  if (typeof msg === 'object' && msg !== null && 'type' in msg) {
    const type = (msg as { type?: unknown }).type
    if (type === 'monitorTabNetwork' || type === 'unmonitorTabNetwork' || type === 'isTabNetworkMonitored') {
      return 'tabId' in msg && typeof (msg as { tabId?: unknown }).tabId === 'number'
    }
    if (type === 'getNetworkStats' || type === 'clearNetworkStats') {
      return true
    }
  }
  return false
}
