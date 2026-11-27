import { proxyRows, ruleRows } from '@utils/pageView'

const goodProxy = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }

describe('usable rows carry no reasons and no raw entry', () => {
  it('gives a usable proxy row no faults and no raw entry', () => {
    const [row] = proxyRows([goodProxy])
    expect(row.invalid).toBe(false)
    expect(row.faults).toEqual([])
    expect(row.rawEntry).toBeUndefined()
  })

  it('gives a usable rule row no faults and no ignored note when staticExtensions is valid', () => {
    const [row] = ruleRows([{ ...goodRule, staticExtensions: '/\\.png$/' }], [goodProxy])
    expect(row.invalid).toBe(false)
    expect(row.faults).toEqual([])
    expect(row.ignoredNote).toBeUndefined()
  })

  it('gives an object rule row no raw entry', () => {
    const [row] = ruleRows([goodRule], [goodProxy])
    expect(row.rawEntry).toBeUndefined()
  })

  it('gives a null entry no raw entry', () => {
    const [row] = proxyRows([null])
    expect(row.rawEntry).toBeUndefined()
  })

  it('does not set aside a rule whose only fault is its staticExtensions value', () => {
    const [row] = ruleRows([{ ...goodRule, staticExtensions: '/(/' }], [goodProxy])
    expect(row.invalid).toBe(false)
    expect(row.faults).toEqual([])
  })
})
