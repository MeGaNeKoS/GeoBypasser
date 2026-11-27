import browser, { WebRequest } from 'webextension-polyfill'
import type { NetworkMonitor } from '@core/networkMonitor'

type CompletedDetails = WebRequest.OnCompletedDetailsType & { encodedDataLength?: number }

function contentLengthBytes (requestHeaders: WebRequest.HttpHeaders | undefined): number | undefined {
  const header = requestHeaders?.find(h => h.name.toLowerCase() === 'content-length')
  if (!header) return undefined
  const bytes = parseInt(header.value || '0', 10)
  return isNaN(bytes) ? undefined : bytes
}

export function registerChromeNetworkMonitor (monitor: NetworkMonitor) {
  const sentBytesByRequest = new Map<string, number>()

  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      if (!monitor.isTabMonitored(details.tabId)) return
      const bytes = contentLengthBytes(details.requestHeaders)
      if (bytes !== undefined) sentBytesByRequest.set(details.requestId, bytes)
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders'],
  )

  browser.webRequest.onCompleted.addListener(
    (details: CompletedDetails) => {
      const sentBytes = sentBytesByRequest.get(details.requestId) ?? 0
      sentBytesByRequest.delete(details.requestId)
      monitor.recordTransfer(details.tabId, details.url, {
        sentBytes,
        receivedBytes: details.encodedDataLength ?? 0,
      })
    },
    { urls: ['<all_urls>'] },
  )

  browser.webRequest.onErrorOccurred.addListener(
    details => {
      sentBytesByRequest.delete(details.requestId)
    },
    { urls: ['<all_urls>'] },
  )
}
