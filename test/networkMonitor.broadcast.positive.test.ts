import { createNetworkMonitor } from '@core/networkMonitor'

const TAB = 4

describe('a tab monitoring change is broadcast to extension pages', () => {
  it('broadcasts that a tab became monitored when monitoring starts', () => {
    const broadcast = jest.fn()
    const monitor = createNetworkMonitor(broadcast)

    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB })

    expect(broadcast).toHaveBeenCalledWith(TAB, true)
  })

  it('broadcasts that a tab stopped being monitored when monitoring stops', () => {
    const broadcast = jest.fn()
    const monitor = createNetworkMonitor(broadcast)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB })

    monitor.answerNetworkMessage({ type: 'unmonitorTabNetwork', tabId: TAB })

    expect(broadcast).toHaveBeenLastCalledWith(TAB, false)
  })

  it('broadcasts that a monitored tab stopped being monitored when the tab closes', () => {
    const broadcast = jest.fn()
    const monitor = createNetworkMonitor(broadcast)
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB })

    monitor.forgetTab(TAB)

    expect(broadcast).toHaveBeenLastCalledWith(TAB, false)
    expect(monitor.isTabMonitored(TAB)).toBe(false)
  })
})
