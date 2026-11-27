import { createNetworkMonitor } from '@core/networkMonitor'
import { networkStats, resetNetworkStats } from '@utils/network'

const TAB_ID = 7
const URL = 'https://media.example.com/video/clip'

describe('network monitor without a monitored tab', () => {
  beforeEach(() => resetNetworkStats())

  it('ignores transfers for a tab that was never monitored', () => {
    const monitor = createNetworkMonitor()

    monitor.recordTransfer(TAB_ID, URL, { sentBytes: 120, receivedBytes: 4096 })

    expect(networkStats.domains['media.example.com']).toBeUndefined()
  })

  it('stops recording once the tab is unmonitored', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.answerNetworkMessage({ type: 'unmonitorTabNetwork', tabId: TAB_ID })

    monitor.recordTransfer(TAB_ID, URL, { sentBytes: 120, receivedBytes: 4096 })

    expect(networkStats.domains['media.example.com']).toBeUndefined()
  })

  it('stops recording once the tab is forgotten after it closes', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
    monitor.forgetTab(TAB_ID)

    monitor.recordTransfer(TAB_ID, URL, { sentBytes: 120, receivedBytes: 4096 })

    expect(networkStats.domains['media.example.com']).toBeUndefined()
  })
})
