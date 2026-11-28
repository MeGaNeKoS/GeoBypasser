import { browser } from './setup'
import { registerFirefoxNetworkMonitor } from '@adapters/firefox'
import { createNetworkMonitor } from '@core/networkMonitor'
import type { NetworkUsage } from '@utils/networkUsage'

const TAB_ID = 3
const URL = 'https://cdn.example.com/a/file.bin'
const DOCUMENT_URL = 'https://page.example/home'

type Listener = (details: unknown) => void

function fire (event: { _listeners: Listener[] }, details: unknown) {
  event._listeners.forEach(listener => listener(details))
}

function usageOf (monitor: ReturnType<typeof createNetworkMonitor>): NetworkUsage {
  return monitor.answerNetworkMessage({ type: 'getNetworkStats' }) as NetworkUsage
}

describe('Firefox network adapter', () => {
  beforeEach(() => {
    for (const event of [browser.webRequest.onCompleted, browser.webRequest.onErrorOccurred]) {
      event._listeners.length = 0
    }
  })

  it('records the request size sent and the response size received', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    registerFirefoxNetworkMonitor(monitor)

    fire(browser.webRequest.onCompleted, {
      tabId: TAB_ID,
      requestId: 'req-1',
      url: URL,
      documentUrl: DOCUMENT_URL,
      type: 'image',
      statusCode: 200,
      fromCache: false,
      requestSize: 300,
      responseSize: 4096,
    })

    const host = usageOf(monitor)[TAB_ID]['page.example']['cdn.example.com']
    expect(host.sent).toBe(300)
    expect(host.received).toBe(4096)
    expect(host.unsizedCount).toBe(0)
  })

  it('records a failed request under its error', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    registerFirefoxNetworkMonitor(monitor)

    fire(browser.webRequest.onErrorOccurred, {
      tabId: TAB_ID,
      requestId: 'req-2',
      url: URL,
      documentUrl: DOCUMENT_URL,
      type: 'image',
      error: 'NS_ERROR_NET_TIMEOUT',
      fromCache: false,
    })

    expect(usageOf(monitor)[TAB_ID]['page.example']['cdn.example.com'].failures).toEqual({ NS_ERROR_NET_TIMEOUT: 1 })
  })

  it('records nothing for a tab that is not monitored', () => {
    const monitor = createNetworkMonitor()
    registerFirefoxNetworkMonitor(monitor)

    fire(browser.webRequest.onCompleted, {
      tabId: TAB_ID,
      requestId: 'req-3',
      url: URL,
      type: 'image',
      statusCode: 200,
      fromCache: false,
      requestSize: 300,
      responseSize: 4096,
    })

    expect(usageOf(monitor)).toEqual({})
  })
})
