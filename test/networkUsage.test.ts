import { assertNetworkStats, NetworkStatsSchema } from '../src/schemas/networkStats'
import { usageRows } from '../src/utils/networkUsage'

describe('network usage rows', () => {
  it('keeps a domain named __proto__ from a received payload', () => {
    const payload: unknown = JSON.parse('{"total":{"sent":3,"received":4},"domains":{"__proto__":{"sent":3,"received":4}}}')
    assertNetworkStats(payload)

    expect(usageRows(payload.domains).map(row => row.name)).toEqual(['__proto__'])
  })

  it('formats sent and received bytes and keeps nested paths', () => {
    const rows = usageRows({
      'example.com': {
        sent: 2048,
        received: 0,
        children: { '/api': { sent: 1024, received: 512 } },
      },
    })

    expect(rows).toEqual([
      {
        name: 'example.com',
        sent: '2.00 KB',
        received: '0 B',
        children: [{ name: '/api', sent: '1.00 KB', received: '512 B', children: [] }],
      },
    ])
  })

  it('lists domains in the order they were recorded', () => {
    const rows = usageRows({
      'b.test': { sent: 1, received: 1 },
      'a.test': { sent: 2, received: 2 },
    })

    expect(rows.map(row => row.name)).toEqual(['b.test', 'a.test'])
  })

  it('returns no rows when nothing was recorded', () => {
    expect(usageRows({})).toEqual([])
  })

  it('accepts a stats payload with a total and domains', () => {
    const stats = NetworkStatsSchema.parse({
      total: { sent: 3, received: 4, children: {} },
      domains: { 'example.com': { sent: 3, received: 4, children: {} } },
    })

    expect(stats.domains['example.com']).toEqual({ sent: 3, received: 4, children: {} })
  })
})
