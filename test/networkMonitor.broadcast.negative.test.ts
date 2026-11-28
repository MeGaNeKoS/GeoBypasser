import { createNetworkMonitor } from '@core/networkMonitor'

const TAB = 4

describe('a tab monitoring change is not broadcast when nothing changed', () => {
  it('does not broadcast when a tab that was never monitored closes', () => {
    const broadcast = jest.fn()
    const monitor = createNetworkMonitor(broadcast)

    monitor.forgetTab(TAB)

    expect(broadcast).not.toHaveBeenCalled()
  })

  it('does not broadcast when a read of the monitored state happens', () => {
    const broadcast = jest.fn()
    const monitor = createNetworkMonitor(broadcast)

    monitor.answerNetworkMessage({ type: 'isTabNetworkMonitored', tabId: TAB })

    expect(broadcast).not.toHaveBeenCalled()
  })
})
