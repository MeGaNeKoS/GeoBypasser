import { addNetworkData, resetNetworkStats, networkStats } from '@utils/network'
import { browser } from './setup'

// Import background to register message handlers
import '../src/background.firefox'

describe('network stats', () => {
  beforeEach(() => resetNetworkStats())

  it('aggregates data by domain and path', () => {
    addNetworkData('https://a.com/foo/bar', 10, 20)
    addNetworkData('https://a.com/foo/baz', 5, 5)
    addNetworkData('https://b.com/', 2, 3)

    expect(networkStats.total.sent).toBe(17)
    expect(networkStats.total.received).toBe(28)
    expect(networkStats.domains['a.com'].sent).toBe(15)
    expect(networkStats.domains['a.com'].children!['foo'].received).toBe(25)
    expect(networkStats.domains['a.com'].children!['foo'].children!['bar'].sent).toBe(10)
  })

  it('provides stats via message', async () => {
    addNetworkData('https://c.com/a/b', 1, 2)
    const stats = await browser.runtime.sendMessage({ type: 'getNetworkStats' })
    expect(stats.domains['c.com'].children!['a'].sent).toBe(1)
    expect(stats.domains['c.com'].children!['a'].children!['b'].received).toBe(2)
  })

  it('ignores entries with zero data', () => {
    addNetworkData('https://d.com/a/b', 0, 0)
    expect(networkStats.domains['d.com']).toBeUndefined()
  })
})
