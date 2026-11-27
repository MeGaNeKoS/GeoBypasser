import browser from 'webextension-polyfill'
import type { NetworkMonitor } from '@core/networkMonitor'

export function registerFirefoxNetworkMonitor (monitor: NetworkMonitor) {
  browser.webRequest.onCompleted.addListener(
    details => {
      monitor.recordTransfer(details.tabId, details.url, {
        sentBytes: details.requestSize,
        receivedBytes: details.responseSize,
      })
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  )
}
