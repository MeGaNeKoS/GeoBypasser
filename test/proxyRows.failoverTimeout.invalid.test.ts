import { proxyRows } from '@utils/pageView'

const goodProxy = { id: 'p1', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }
const NOTE = 'Failover timeout is not a number, so the default is used.'

describe('a proxy whose failover timeout is not a whole number of seconds shows Setting ignored, not set aside', () => {
  it.each([0, -5, 2.5, '12'])('gives the note for %p and leaves the row usable', value => {
    const [row] = proxyRows([{ ...goodProxy, failoverTimeout: value }])
    expect(row.invalid).toBe(false)
    expect(row.faults).toEqual([])
    expect(row.ignoredNote).toBe(NOTE)
  })

  it('gives no note to a row set aside for another fault', () => {
    const [row] = proxyRows([{ ...goodProxy, host: '', failoverTimeout: 0 }])
    expect(row.invalid).toBe(true)
    expect(row.ignoredNote).toBeUndefined()
  })
})
