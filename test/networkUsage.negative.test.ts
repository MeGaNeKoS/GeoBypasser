import { NetworkStatsSchema } from '../src/schemas/networkStats'
import { usageRows } from '../src/utils/networkUsage'

describe('network usage rows without traffic', () => {
  it('drops a domain with no traffic together with its children', () => {
    const rows = usageRows({
      'quiet.test': { sent: 0, received: 0, children: { '/x': { sent: 5, received: 5 } } },
    })

    expect(rows).toEqual([])
  })

  it('drops a path with no traffic and keeps its busy sibling', () => {
    const rows = usageRows({
      'example.com': {
        sent: 5,
        received: 0,
        children: {
          '/quiet': { sent: 0, received: 0 },
          '/busy': { sent: 5, received: 0 },
        },
      },
    })

    expect(rows[0].children.map(child => child.name)).toEqual(['/busy'])
  })
})

describe('network usage payload rejection', () => {
  it('rejects a payload without a total', () => {
    expect(() => NetworkStatsSchema.parse({ domains: {} })).toThrow()
  })

  it('rejects a negative byte count', () => {
    expect(() => NetworkStatsSchema.parse({
      total: { sent: 0, received: 0 },
      domains: { 'example.com': { sent: -1, received: 0 } },
    })).toThrow()
  })

  it('rejects byte counts sent as text', () => {
    expect(() => NetworkStatsSchema.parse({
      total: { sent: 0, received: 0 },
      domains: { 'example.com': { sent: '12', received: 0 } },
    })).toThrow()
  })

  it('rejects a nested node missing its received count', () => {
    expect(() => NetworkStatsSchema.parse({
      total: { sent: 0, received: 0 },
      domains: { 'example.com': { sent: 1, received: 1, children: { '/a': { sent: 1 } } } },
    })).toThrow()
  })
})
