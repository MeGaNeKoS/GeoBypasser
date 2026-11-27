import { overrideRows } from '@utils/pageView'

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }

describe('override rows built from a config with a mixed case key', () => {
  it('shows the key with the spelling it was stored with', () => {
    expect(overrideRows({ 'Mixed.Example.NET': 'good' }, [good])).toEqual([
      { domain: 'Mixed.Example.NET', proxyLabel: 'Good' },
    ])
  })
})
