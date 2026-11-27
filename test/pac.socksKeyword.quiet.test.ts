import type { ProxyListItem } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript } from '@utils/pac'
import { evaluatePac } from './pacEvaluation'

const socksProxy: ProxyListItem = { id: 'socks', type: 'socks', host: 'socks.lan', port: 1080, proxyDNS: true }
const httpProxy: ProxyListItem = { id: 'web', type: 'http', host: 'web.lan', port: 8080, proxyDNS: false }

function configFor (proxy: ProxyListItem): GeoBypassRuntimeSettings {
  return {
    proxyList: [proxy],
    defaultProxy: proxy.id,
    fallbackDirect: false,
    testProxyUrl: 'https://t/',
    rules: [],
    perWebsiteOverride: {},
  }
}

describe('the bare SOCKS keyword', () => {
  it('never appears in the PAC script for a socks proxy', () => {
    expect(generatePacScript(configFor(socksProxy))).not.toMatch(/SOCKS(?!5)/)
  })

  it('is not the route an http proxy gets', () => {
    expect(evaluatePac(generatePacScript(configFor(httpProxy)), 'https://example.com/')).toBe('PROXY web.lan:8080')
  })
})
