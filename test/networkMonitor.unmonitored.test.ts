import { createNetworkMonitor, type RequestOutcome } from '@core/networkMonitor'
import { parseNetworkUsageReply } from '@schemas/networkUsage'
import type { NetworkUsage, RecordedRoute } from '@utils/networkUsage'

const TAB_ID = 7
const REQUEST_ID = 'request-1'
const URL = 'https://media.example.com/video/clip'
const ROUTE: RecordedRoute = { reason: 'rule', route: 'PROXY good.lan:8080', expected: false, rule: { index: 0, name: 'media' } }

function outcome (): RequestOutcome {
  return {
    pageHost: 'page.example',
    requestUrl: URL,
    resourceType: 'media',
    statusCode: 200,
    fromCache: false,
    sentBytes: 120,
    receivedBytes: 4096,
    receivedSizeKnown: true,
  }
}

function usageOf (monitor: ReturnType<typeof createNetworkMonitor>): NetworkUsage {
  return parseNetworkUsageReply(monitor.answerNetworkMessage({ type: 'getNetworkStats' }))
}

describe('network monitor without a monitored tab', () => {
  it('ignores a request for a tab that was never monitored', () => {
    const monitor = createNetworkMonitor(() => undefined)

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(usageOf(monitor)).toEqual({})
  })

  it('drops a route noted before the tab was monitored', () => {
    const monitor = createNetworkMonitor(() => undefined)
    monitor.noteRoute(REQUEST_ID, TAB_ID, ROUTE)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })

    monitor.recordRequest(TAB_ID, REQUEST_ID, { ...outcome(), observedRoute: ROUTE.route })

    const host = usageOf(monitor)[TAB_ID]['page.example']['media.example.com']
    expect(Object.values(host.routes)).toEqual([expect.objectContaining({ route: { reason: 'unknown', route: ROUTE.route, expected: false }, count: 1 })])
  })

  it('stops recording once the tab is unmonitored', () => {
    const monitor = createNetworkMonitor(() => undefined)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.answerNetworkMessage({ type: 'unmonitorTabNetwork', tabId: TAB_ID })

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(usageOf(monitor)).toEqual({})
  })

  it('stops recording once the tab is forgotten after it closes', () => {
    const monitor = createNetworkMonitor(() => undefined)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())
    monitor.forgetTab(TAB_ID)

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(usageOf(monitor)).toEqual({})
  })
})
