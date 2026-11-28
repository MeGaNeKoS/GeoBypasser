import { createNetworkMonitor, type RequestOutcome } from '@core/networkMonitor'
import { parseNetworkUsageReply } from '@schemas/networkUsage'
import { FAILED_BEFORE_ROUTE, type NetworkUsage, type RecordedRoute } from '@utils/networkUsage'

const TAB_ID = 7
const REQUEST_ID = 'request-1'
const PAGE_HOST = 'page.example'
const URL = 'https://media.example.com/video/clip'
const RULE_PROXY = 'PROXY good.lan:8080'
const RULE_ROUTE: RecordedRoute = { reason: 'rule', route: RULE_PROXY, expected: false, rule: { index: 0, name: 'media' } }
const TAB_ROUTE: RecordedRoute = { reason: 'tab', route: RULE_PROXY, expected: false }
const DIRECT_DEFAULT_ROUTE: RecordedRoute = { reason: 'default', route: 'DIRECT', expected: false }

function outcome (overrides: Partial<RequestOutcome> = {}): RequestOutcome {
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
  const monitor = createNetworkMonitor(() => undefined)
  monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId })
  return monitor
}

function usageOf (monitor: ReturnType<typeof createNetworkMonitor>): NetworkUsage {
  return parseNetworkUsageReply(monitor.answerNetworkMessage({ type: 'getNetworkStats' }))
}

describe('network monitor recording', () => {
  it('records the sent and received bytes of a request for a monitored tab', () => {
    const monitor = monitorTab()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(host.sent).toBe(120)
    expect(host.received).toBe(4096)
  })

  it('records the noted route as observed when its proxy is the one the request used', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: RULE_PROXY }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: RULE_ROUTE, count: 1 })])
  })

  it('marks the noted route inferred when no observed route is given', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: { ...RULE_ROUTE, inferred: true }, count: 1 })])
  })

  it('records an observed direct request as direct with an unknown reason when only a proxy was expected', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: 'DIRECT' }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: { reason: 'unknown', route: 'DIRECT', expected: false }, count: 1 })])
  })

  it('records an observed proxy that differs from the expected proxy as observed, not inferred', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: 'PROXY other.lan:3128' }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: { reason: 'unknown', route: 'PROXY other.lan:3128', expected: false }, count: 1 })])
  })

  it('settles on the lowest precedence route that matches the observed route, not the arrival order', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE, 2)
    monitor.noteRoute(REQUEST_ID, TAB_ID, TAB_ROUTE, 0)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: RULE_PROXY }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: TAB_ROUTE, count: 1 })])
  })

  it('settles on the route matching the observed proxy over a higher precedence route that does not match', () => {
    const monitor = monitorTab()

    monitor.noteRoute(REQUEST_ID, TAB_ID, DIRECT_DEFAULT_ROUTE, 0)
    monitor.noteRoute(REQUEST_ID, TAB_ID, RULE_ROUTE, 2)
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: RULE_PROXY }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: RULE_ROUTE, count: 1 })])
  })

  it('records a direct request that no handler answered as the default route', () => {
    const monitor = monitorTab()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: 'DIRECT' }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: DIRECT_DEFAULT_ROUTE, count: 1 })])
  })

  it('records an observed proxy that no handler answered as an unknown route to that proxy', () => {
    const monitor = monitorTab()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: RULE_PROXY }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: { reason: 'unknown', route: RULE_PROXY, expected: false }, count: 1 })])
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
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ observedRoute: RULE_PROXY }))
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    const routes = Object.values(usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com'].routes)
    expect(routes.map(tally => [tally.route.reason, tally.count])).toEqual([['rule', 1], ['unknown', 1]])
  })

  it('records a failed request that no route reached as failed before routing', () => {
    const monitor = monitorTab()
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome({ statusCode: undefined, error: 'NS_ERROR_UNKNOWN_HOST' }))

    const host = usageOf(monitor)[TAB_ID][PAGE_HOST]['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: FAILED_BEFORE_ROUTE, count: 1 })])
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
