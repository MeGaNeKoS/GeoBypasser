import { overrideRows } from '@utils/pageView'

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }

describe('override rows built from a config with a mixed case key', () => {
  it('shows the key with the spelling it was stored with', () => {
    expect(overrideRows({ 'Mixed.Example.NET': 'good' }, [good])).toEqual([
      { domain: 'Mixed.Example.NET', invalid: false, faults: [], direct: false, proxyLabel: 'Good', proxyLabelIsId: false, missingProxy: false },
    ])
  })

  it('labels a site whose proxy is set aside with that proxy label, and a removed proxy with its raw id', () => {
    const setAside = { id: 'broken', type: 'http', label: 'Broken' }
    expect(overrideRows({ 'a.example': 'broken', 'b.example': 'gone' }, [setAside]).map(row => [row.proxyLabel, row.proxyLabelIsId]))
      .toEqual([['Broken', false], ['gone', true]])
  })

  it('labels a site sent directly as Direct, not as a missing proxy', () => {
    expect(overrideRows({ 'example.com': 'direct' }, [good])).toEqual([
      { domain: 'example.com', invalid: false, faults: [], direct: true, proxyLabel: 'Direct', proxyLabelIsId: false, missingProxy: false },
    ])
  })
})
