import { browser } from './setup'
import { registerFirefoxNetworkMonitor } from '@adapters/firefox'
import { createNetworkMonitor, type NetworkMonitor } from '@core/networkMonitor'
import { parseNetworkUsageReply } from '@schemas/networkUsage'
import type { NetworkUsage, PathNode, RecordedRoute, RouteTally } from '@utils/networkUsage'

const TAB_ID = 3
const URL = 'https://cdn.example.com/a/file.bin'
const DOCUMENT_URL = 'https://page.example/home'
const RULE_PROXY_ROUTE: RecordedRoute = { reason: 'rule', route: 'PROXY 127.0.0.1:18081', expected: false, rule: { index: 0, name: 'cdn' } }
const DIRECT_DEFAULT_ROUTE: RecordedRoute = { reason: 'default', route: 'DIRECT', expected: false }

type Listener = (details: unknown) => void

function fire (event: { _listeners: Listener[] }, details: unknown) {
  event._listeners.forEach(listener => listener(details))
}

function usageOf (monitor: ReturnType<typeof createNetworkMonitor>): NetworkUsage {
  return parseNetworkUsageReply(monitor.answerNetworkMessage({ type: 'getNetworkStats' }))
}

describe('Firefox network adapter', () => {
  beforeEach(() => {
    for (const event of [browser.webRequest.onCompleted, browser.webRequest.onErrorOccurred]) {
      event._listeners.length = 0
    }
  })

  it('keeps a request whose path segments are named constructor and __proto__', () => {
    const monitor = createNetworkMonitor(() => undefined)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    registerFirefoxNetworkMonitor(monitor)

    fire(browser.webRequest.onCompleted, {
      tabId: TAB_ID,
      requestId: 'req-proto',
      url: 'http://127.0.0.1:8080/constructor/__proto__/',
      documentUrl: 'http://127.0.0.1:8080/page/',
      type: 'xmlhttprequest',
      statusCode: 200,
      fromCache: false,
      requestSize: 100,
      responseSize: 200,
    })

    const tree: Record<string, PathNode> = usageOf(monitor)[TAB_ID]['127.0.0.1']['127.0.0.1'].paths
    expect(Object.keys(tree)).toEqual(['constructor'])
    expect(Object.keys(tree['constructor'].children)).toEqual(['__proto__'])
    expect(tree['constructor'].children['__proto__'].received).toBe(200)
  })

  it('records the request size sent and the response size received', () => {
    const monitor = createNetworkMonitor(() => undefined)
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
    const monitor = createNetworkMonitor(() => undefined)
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
    const monitor = createNetworkMonitor(() => undefined)
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

  it('records the route a handler answered when the completed request used that proxy', () => {
    const monitor = monitorWithNotedRoute('req-4', RULE_PROXY_ROUTE)

    fire(browser.webRequest.onCompleted, completedDetails('req-4', { proxyInfo: { type: 'http', host: '127.0.0.1', port: 18081 } }))

    expect(routesOf(monitor)).toEqual([expect.objectContaining({ route: RULE_PROXY_ROUTE, count: 1 })])
  })

  it('marks the noted route inferred when the completed request carries no proxy info for it', () => {
    const monitor = monitorWithNotedRoute('req-5', RULE_PROXY_ROUTE)

    fire(browser.webRequest.onCompleted, completedDetails('req-5'))

    expect(routesOf(monitor)).toEqual([expect.objectContaining({ route: { ...RULE_PROXY_ROUTE, inferred: true }, count: 1 })])
  })

  it('records a direct completed request as the noted direct route', () => {
    const monitor = monitorWithNotedRoute('req-6', DIRECT_DEFAULT_ROUTE)

    fire(browser.webRequest.onCompleted, completedDetails('req-6', { proxyInfo: { type: 'direct' } }))

    expect(routesOf(monitor)).toEqual([expect.objectContaining({ route: DIRECT_DEFAULT_ROUTE, count: 1 })])
  })

  it('marks the noted route inferred when the proxy info does not parse', () => {
    const monitor = monitorWithNotedRoute('req-7', RULE_PROXY_ROUTE)

    fire(browser.webRequest.onCompleted, completedDetails('req-7', { proxyInfo: { type: 42 } }))

    expect(routesOf(monitor)).toEqual([expect.objectContaining({ route: { ...RULE_PROXY_ROUTE, inferred: true }, count: 1 })])
  })

  it('records a failed request on the direct route its proxy info reports', () => {
    const monitor = monitorWithNotedRoute('req-8', DIRECT_DEFAULT_ROUTE)

    fire(browser.webRequest.onErrorOccurred, {
      tabId: TAB_ID,
      requestId: 'req-8',
      url: URL,
      documentUrl: DOCUMENT_URL,
      type: 'image',
      error: 'NS_ERROR_NET_TIMEOUT',
      fromCache: false,
      proxyInfo: { type: 'direct' },
    })

    expect(routesOf(monitor)).toEqual([expect.objectContaining({ route: DIRECT_DEFAULT_ROUTE, count: 1 })])
  })
})

function monitorWithNotedRoute (requestId: string, route: RecordedRoute): NetworkMonitor {
  const monitor = createNetworkMonitor(() => undefined)
  monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
  monitor.noteRoute(requestId, TAB_ID, route)
  registerFirefoxNetworkMonitor(monitor)
  return monitor
}

function completedDetails (requestId: string, extra: Record<string, unknown> = {}) {
  return {
    tabId: TAB_ID,
    requestId,
    url: URL,
    documentUrl: DOCUMENT_URL,
    type: 'image',
    statusCode: 200,
    fromCache: false,
    requestSize: 300,
    responseSize: 4096,
    ...extra,
  }
}

function routesOf (monitor: NetworkMonitor): RouteTally[] {
  return Object.values(usageOf(monitor)[TAB_ID]['page.example']['cdn.example.com'].routes)
}
