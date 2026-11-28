import { browser } from './setup'
import { registerChromeNetworkMonitor } from '@adapters/chrome'
import { createNetworkMonitor } from '@core/networkMonitor'
import { parseNetworkUsageReply } from '@schemas/networkUsage'
import type { NetworkUsage, RecordedRoute } from '@utils/networkUsage'

const TAB_ID = 4
const REQUEST_ID = 'req-1'
const URL = 'https://cdn.example.com/a/file.bin'
const DOCUMENT_URL = 'https://page.example/home'
const EXPECTED_RULE_ROUTE: RecordedRoute = { reason: 'rule', route: 'PROXY good.lan:8080', expected: true, rule: { index: 0, name: 'cdn' } }

type Listener = (details: unknown) => void

function fire (event: { _listeners: Listener[] }, details: unknown) {
  event._listeners.forEach(listener => listener(details))
}

function header (name: string, value: string) {
  return { name, value }
}

function setUp () {
  const monitor = createNetworkMonitor(() => undefined)
  monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
  const routes: string[] = []
  registerChromeNetworkMonitor(monitor, async requestUrl => {
    routes.push(requestUrl)
    return EXPECTED_RULE_ROUTE
  })
  return { monitor, routes }
}

function usageOf (monitor: ReturnType<typeof createNetworkMonitor>): NetworkUsage {
  return parseNetworkUsageReply(monitor.answerNetworkMessage({ type: 'getNetworkStats' }))
}

function hostUsage (monitor: ReturnType<typeof createNetworkMonitor>) {
  return usageOf(monitor)[TAB_ID]['page.example']['cdn.example.com']
}

function flushPromises () {
  return new Promise(resolve => setImmediate(resolve))
}

function completedDetails (responseHeaders: { name: string; value: string }[]) {
  return {
    tabId: TAB_ID, requestId: REQUEST_ID, url: URL, documentUrl: DOCUMENT_URL, type: 'image',
    statusCode: 200, fromCache: false, responseHeaders,
  }
}

describe('Chrome network adapter', () => {
  beforeEach(() => {
    for (const event of [browser.webRequest.onBeforeSendHeaders, browser.webRequest.onCompleted, browser.webRequest.onErrorOccurred]) {
      event._listeners.length = 0
    }
  })

  it('records the request Content-Length as sent and the response Content-Length as received', async () => {
    const { monitor } = setUp()

    fire(browser.webRequest.onBeforeSendHeaders, {
      tabId: TAB_ID, requestId: REQUEST_ID, url: URL, requestHeaders: [header('Content-Length', '300')],
    })
    fire(browser.webRequest.onCompleted, completedDetails([header('content-length', '4096')]))
    await flushPromises()

    expect(hostUsage(monitor).sent).toBe(300)
    expect(hostUsage(monitor).received).toBe(4096)
  })

  it('counts a response without Content-Length as unsized', async () => {
    const { monitor } = setUp()

    fire(browser.webRequest.onCompleted, completedDetails([]))
    await flushPromises()

    expect(hostUsage(monitor).unsizedCount).toBe(1)
    expect(hostUsage(monitor).received).toBe(0)
  })

  it('takes the sent bytes once, so a second completion for the same id sends nothing', async () => {
    const { monitor } = setUp()
    fire(browser.webRequest.onBeforeSendHeaders, {
      tabId: TAB_ID, requestId: REQUEST_ID, url: URL, requestHeaders: [header('Content-Length', '300')],
    })

    fire(browser.webRequest.onCompleted, completedDetails([]))
    fire(browser.webRequest.onCompleted, completedDetails([]))
    await flushPromises()

    expect(hostUsage(monitor).sent).toBe(300)
  })

  it('takes the sent bytes of a failed request once, so a later completion sends nothing more', async () => {
    const { monitor } = setUp()
    fire(browser.webRequest.onBeforeSendHeaders, {
      tabId: TAB_ID, requestId: REQUEST_ID, url: URL, requestHeaders: [header('Content-Length', '300')],
    })

    fire(browser.webRequest.onErrorOccurred, {
      tabId: TAB_ID, requestId: REQUEST_ID, url: URL, documentUrl: DOCUMENT_URL, type: 'image',
      error: 'net::ERR_ABORTED', fromCache: false,
    })
    fire(browser.webRequest.onCompleted, completedDetails([]))
    await flushPromises()

    expect(hostUsage(monitor).sent).toBe(300)
  })

  it('records a failed request under its error with no received bytes', async () => {
    const { monitor } = setUp()

    fire(browser.webRequest.onErrorOccurred, {
      tabId: TAB_ID, requestId: REQUEST_ID, url: URL, documentUrl: DOCUMENT_URL, type: 'image',
      error: 'net::ERR_CONNECTION_RESET', fromCache: false,
    })
    await flushPromises()

    expect(hostUsage(monitor).failures).toEqual({ 'net::ERR_CONNECTION_RESET': 1 })
    expect(hostUsage(monitor).received).toBe(0)
  })

  it('records the expected route of a completed request, asked at completion', async () => {
    const { monitor, routes } = setUp()

    fire(browser.webRequest.onBeforeSendHeaders, { tabId: TAB_ID, requestId: REQUEST_ID, url: URL, requestHeaders: [] })
    expect(routes).toEqual([])
    fire(browser.webRequest.onCompleted, completedDetails([]))
    await flushPromises()

    expect(routes).toEqual([URL])
    expect(Object.values(hostUsage(monitor).routes)).toEqual([{ route: EXPECTED_RULE_ROUTE, count: 1, bytes: 0 }])
  })

  it('does not ask for the route of a request on an unmonitored tab', async () => {
    const { routes } = setUp()

    fire(browser.webRequest.onCompleted, { ...completedDetails([]), tabId: 99 })
    await flushPromises()

    expect(routes).toEqual([])
  })
})
