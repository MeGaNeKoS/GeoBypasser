import { browser } from './setup'
import { registerFirefoxNetworkMonitor } from '@adapters/firefox'
import { createNetworkMonitor } from '@core/networkMonitor'
import { networkStats, resetNetworkStats } from '@utils/network'

const TAB_ID = 3
const URL = 'https://cdn.example.com/a/file.bin'

function fire (event: { _listeners: Array<(details: unknown) => void> }, details: unknown) {
  event._listeners.forEach(listener => listener(details))
}

describe('Firefox network adapter totals', () => {
  beforeEach(() => {
    resetNetworkStats()
    browser.webRequest.onCompleted._listeners.length = 0
  })

  it('records the request size sent and the response size received', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    registerFirefoxNetworkMonitor(monitor)

    fire(browser.webRequest.onCompleted, {
      tabId: TAB_ID,
      url: URL,
      requestSize: 300,
      responseSize: 4096,
    })

    expect(networkStats.domains['cdn.example.com'].sent).toBe(300)
    expect(networkStats.domains['cdn.example.com'].received).toBe(4096)
  })
})
