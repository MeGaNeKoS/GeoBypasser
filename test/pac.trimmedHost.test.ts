import { generatePacScript } from '@utils/pac'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const padded: ProxyListItem = { id: 'good', type: 'http', host: ' good.lan ', port: 8080, proxyDNS: false } as any
const rule: ProxyRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' } as any

describe('PAC script for a proxy with whitespace around its host', () => {
  it('names the trimmed host and no padded host', () => {
    const pac = generatePacScript({
      proxyList: [padded],
      defaultProxy: 'good',
      fallbackDirect: false,
      testProxyUrl: 'https://www.google.com/',
      rules: compileRules([rule]),
      perWebsiteOverride: {},
      keepAliveRules: {},
    } as any)
    expect(pac).toContain('"PROXY good.lan:8080"')
    expect(pac).not.toContain('" good.lan')
  })
})
