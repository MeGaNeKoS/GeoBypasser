import { createNetworkMonitor } from '@core/networkMonitor'
import type { NetworkUsage, RecordedRoute, RequestObservation } from '@utils/networkUsage'

const TAB_ID = 7
const REQUEST_ID = 'request-1'
const URL = 'https://media.example.com/video/clip'
const ROUTE: RecordedRoute = { reason: 'default', route: 'DIRECT', expected: false }

function outcome (): Omit<RequestObservation, 'route'> {
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
  return monitor.answerNetworkMessage({ type: 'getNetworkStats' }) as NetworkUsage
}

describe('network monitor without a monitored tab', () => {
  it('ignores a request for a tab that was never monitored', () => {
    const monitor = createNetworkMonitor()

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(usageOf(monitor)).toEqual({})
  })

  it('ignores a noted route for a tab that was never monitored', () => {
    const monitor = createNetworkMonitor()

    monitor.noteRoute(REQUEST_ID, TAB_ID, ROUTE)

    expect(monitor.answerNetworkMessage({ type: 'isTabNetworkMonitored', tabId: TAB_ID })).toBe(false)
  })

  it('stops recording once the tab is unmonitored', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.answerNetworkMessage({ type: 'unmonitorTabNetwork', tabId: TAB_ID })

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(usageOf(monitor)).toEqual({})
  })

  it('stops recording once the tab is forgotten after it closes', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())
    monitor.forgetTab(TAB_ID)

    monitor.recordRequest(TAB_ID, REQUEST_ID, outcome())

    expect(usageOf(monitor)).toEqual({})
  })
})
