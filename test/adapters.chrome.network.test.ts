import { browser } from './setup'
import { registerChromeNetworkMonitor } from '@adapters/chrome'
import { createNetworkMonitor } from '@core/networkMonitor'
import { networkStats, resetNetworkStats } from '@utils/network'

const TAB_ID = 3
const URL = 'https://cdn.example.com/a/file.bin'

function fire (event: { _listeners: Array<(details: unknown) => void> }, details: unknown) {
  event._listeners.forEach(listener => listener(details))
}

function clearNetworkEvents () {
  const events = [
    browser.webRequest.onBeforeSendHeaders,
    browser.webRequest.onCompleted,
    browser.webRequest.onErrorOccurred,
  ]
  events.forEach(event => { event._listeners.length = 0 })
}

describe('Chrome network adapter totals', () => {
  beforeEach(() => {
    resetNetworkStats()
    clearNetworkEvents()
  })

  it('records the content-length sent and the encoded length received', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    registerChromeNetworkMonitor(monitor)

    fire(browser.webRequest.onBeforeSendHeaders, {
      tabId: TAB_ID,
      requestId: 'r1',
      requestHeaders: [{ name: 'Content-Length', value: '120' }],
    })
    fire(browser.webRequest.onCompleted, {
      tabId: TAB_ID,
      requestId: 'r1',
      url: URL,
      encodedDataLength: 4096,
    })

    expect(networkStats.domains['cdn.example.com'].sent).toBe(120)
    expect(networkStats.domains['cdn.example.com'].received).toBe(4096)
  })
})
