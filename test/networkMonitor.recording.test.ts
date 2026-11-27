import { createNetworkMonitor } from '@core/networkMonitor'
import { networkStats, resetNetworkStats } from '@utils/network'

const TAB_ID = 7
const URL = 'https://media.example.com/video/clip'

describe('network monitor recording', () => {
  beforeEach(() => resetNetworkStats())

  it('records sent and received bytes for a monitored tab', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })

    monitor.recordTransfer(TAB_ID, URL, { sentBytes: 120, receivedBytes: 4096 })

    expect(networkStats.domains['media.example.com'].sent).toBe(120)
    expect(networkStats.domains['media.example.com'].received).toBe(4096)
  })

  it('records a request that sent bytes but received none', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })

    monitor.recordTransfer(TAB_ID, URL, { sentBytes: 300, receivedBytes: 0 })

    expect(networkStats.total.sent).toBe(300)
    expect(networkStats.total.received).toBe(0)
  })

  it('records the sizes of a devtools network report for a monitored tab', () => {
    const monitor = createNetworkMonitor()
    monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })

    monitor.answerNetworkMessage({
      type: 'devtoolsNetworkData',
      tabId: TAB_ID,
      url: URL,
      sentSize: 10,
      receivedSize: 20,
    })

    expect(networkStats.domains['media.example.com'].sent).toBe(10)
    expect(networkStats.domains['media.example.com'].received).toBe(20)
  })
})
