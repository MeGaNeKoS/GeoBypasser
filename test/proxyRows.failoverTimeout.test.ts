import { proxyRows } from '@utils/pageView'

const goodProxy = { id: 'p1', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }

describe('a proxy with a whole-number failover timeout shows no ignored note', () => {
  it('keeps the row usable and adds no note for a whole number of seconds', () => {
    const [row] = proxyRows([{ ...goodProxy, failoverTimeout: 12 }])
    expect(row.invalid).toBe(false)
    expect(row.ignoredNote).toBeUndefined()
  })

  it('adds no note when the failover timeout is left empty', () => {
    const [row] = proxyRows([goodProxy])
    expect(row.ignoredNote).toBeUndefined()
  })
})
