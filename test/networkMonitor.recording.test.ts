import { createNetworkMonitor } from '@core/networkMonitor'
import type { RecordedRoute, RequestObservation } from '@utils/networkUsage'
import type { NetworkUsage } from '@utils/networkUsage'

const TAB_ID = 7
const REQUEST_ID = 'request-1'
const PAGE_HOST = 'page.example'
const URL = 'https://media.example.com/video/clip'
const RULE_ROUTE: RecordedRoute = { reason: 'rule', route: 'PROXY good.lan:8080', expected: false, rule: { index: 0, name: 'media' } }

function outcome (overrides: Partial<Omit<RequestObservation, 'route'>> = {}): Omit<RequestObservation, 'route'> {
  return {
    pageHost: PAGE_HOST,
    requestUrl: URL,
    resourceType: 'media',
    statusCode: 200,
    fromCache: false,
    sentBytes: 120,
    receivedBytes: 4096,
    receivedSizeKnown: true,
    ...overrides,
  }
}

function monitorTab (tabId = TAB_ID) {
  const monitor = createNetworkMonitor()
  monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId })
  return monitor
}

function usageOf (monitor: ReturnType<typeof createNetworkMonitor>): NetworkUsage {
  return monitor.answerNetworkMessage({ type: 'getNetworkStats' }) as NetworkUsage
}

describe('network monitor recording', () => {
  it('records the sent and received bytes of a request for a monitored tab', () => {
    const monitor = monitorTab()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(host.sent).toBe(120)
    expect(host.received).toBe(4096)
  })

  it('records the route noted for the request id', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([{ route: RULE_ROUTE, count: 1 }])
  })

  it('records an unknown route for a request with no noted route', () => {
    const monitor = monitorTab()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)[0].route.reason).toBe('unknown')
  })

  it('uses a noted route once, so a later request with the same id has none', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const routes = Object.values(usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com'].routes)
    expect(routes.map(tally => [tally.route.reason, tally.count])).toEqual([['rule', 1], ['unknown', 1]])
  })

  it('records a failed request under its error', () => {
    const monitor = monitorTab()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ statusCode: undefined, error: 'net::ERR_TIMED_OUT', receivedBytes: 0 }))

    expect(usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com'].failures).toEqual({ 'net::ERR_TIMED_OUT': 1 })
  })

  it('drops a noted route for a tab when the tab is forgotten', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.forgetTab(TAB_ID)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(Object.values(usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com'].routes)[0].route.reason).toBe('unknown')
  })

  it('reports usage keyed by tab id and empties it on clear', () => {
    const monitor = monitorTab()
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(Object.keys(usageOf(monitor))).toEqual([String(TAB_ID)])

    monitor.answerNetworkMessage({ type: 'clearNetworkStats' })

    expect(usageOf(monitor)).toEqual({})
  })

  it('answers whether a tab is monitored', () => {
    const monitor = monitorTab()

    expect(monitor.answerNetworkMessage({ type: 'isTabNetworkMonitored', tabId: TAB_ID })).toBe(true)
  })
})
