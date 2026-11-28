import { overrideRows } from '@utils/pageView'

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }

describe('override rows built from a config with a mixed case key', () => {
  it('shows the key with the spelling it was stored with', () => {
    expect(overrideRows({ 'Mixed.Example.NET': 'good' }, [good])).toEqual([
      { domain: 'Mixed.Example.NET', invalid: false, faults: [], rawEntry: 'good', proxyLabel: 'Good', missingProxy: false },
    ])
  })

  it('labels a site sent directly as Direct, not as a missing proxy', () => {
    expect(overrideRows({ 'example.com': 'direct' }, [good])).toEqual([
      { domain: 'example.com', invalid: false, faults: [], rawEntry: 'direct', proxyLabel: 'Direct', missingProxy: false },
    ])
  })
})
