import { createUsageChangeBroadcast } from '@core/usageChangeBroadcast'
import { createNetworkMonitor } from '@core/networkMonitor'
import { DIRECT_ROUTE } from '@utils/pacRoute'

const TAB = 6

describe('no usage change is sent when nothing was recorded', () => {
  it('sends nothing when no change was noted', () => {
    const send = jest.fn()
    createUsageChangeBroadcast(send, run => run())

    expect(send).not.toHaveBeenCalled()
  })

  it('does not notify for a request on a tab that is not monitored', () => {
    const notifyUsageChanged = jest.fn()
    const monitor = createNetworkMonitor(() => undefined, notifyUsageChanged)

    monitor.recordRequest(TAB, 'req-1', {
      pageHost: 'page.example',
      requestUrl: 'https://cdn.example/a.js',
      resourceType: 'script',
      fromCache: false,
      sentBytes: 0,
      receivedBytes: 0,
      receivedSizeKnown: false,
      observedRoute: DIRECT_ROUTE,
    })

    expect(notifyUsageChanged).not.toHaveBeenCalled()
  })
})
