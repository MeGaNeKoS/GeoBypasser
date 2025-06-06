import { TabProxyMessage } from '@customTypes/messages'

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
