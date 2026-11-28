import { proxyRows, ruleRows } from '@utils/pageView'

const goodProxy = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }

describe('set aside rows carry the reasons and the stored text', () => {
  it('gives a set aside proxy row its fault sentences', () => {
    const [row] = proxyRows([{ ...goodProxy, host: 'a:1; PROXY x:8080' }])
    expect(row.invalid).toBe(true)
    expect(row.faults.length).toBeGreaterThan(0)
  })

  it('gives a proxy row without an id the id fault in addition to its other faults', () => {
    const { id: _id, ...withoutId } = goodProxy
    const [row] = proxyRows([{ ...withoutId, host: 'a:1; PROXY x:8080' }])
    expect(row.faults).toContain('This proxy has no internal id, so rules and sites cannot use it. Open Fix and save to repair it.')
  })

  it('shows a set aside rule its fault sentences', () => {
    const [row] = ruleRows([{ ...goodRule, match: ['not a pattern'] }], [goodProxy])
    expect(row.invalid).toBe(true)
    expect(row.faults.length).toBeGreaterThan(0)
    expect(row.ignoredNote).toBeUndefined()
  })

  it('keeps the stored text of a non-object proxy entry as its raw entry', () => {
    const [row] = proxyRows(['text'])
    expect(row.rawEntry).toBe('text')
    expect(row.label).toBe('(no label)')
  })

  it('keeps the stored text of a non-object rule entry as its raw entry', () => {
    const [row] = ruleRows([42], [goodProxy])
    expect(row.rawEntry).toBe('42')
  })

  it('shows the ignored static extensions note on a usable rule with an invalid staticExtensions value', () => {
    const [row] = ruleRows([{ ...goodRule, staticExtensions: '/(/' }], [goodProxy])
    expect(row.invalid).toBe(false)
    expect(row.ignoredNote).toBe("'Never proxy files matching' is not a valid pattern, so it is ignored. The rule still works.")
  })
})
