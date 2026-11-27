import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript } from '@utils/pac'
import { compileRules } from '@utils/storage'
import { evaluatePac } from './pacEvaluation'

const PROXY_ROUTE = 'PROXY good.lan:8080'

const proxyList = [{ id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false }] as ProxyListItem[]

const plainRule = { name: 'plain', match: ['*://*.example.com/*'], proxyId: 'good' } as ProxyRule
const scopedRule = {
  ...plainRule,
  proxyOnlyResourceTypes: ['image'],
  proxyOnlyPageHostnames: ['site.example'],
} as ProxyRule

function pacFor (rule: ProxyRule): string {
  const settings = {
    proxyList,
    fallbackDirect: false,
    rules: compileRules([rule]),
    perWebsiteOverride: {},
    keepAliveRules: {},
  } as unknown as GeoBypassRuntimeSettings
  return generatePacScript(settings)
}

const requestUrls = [
  'https://a.example.com/x',
  'http://b.example.com/y?z=1',
  'https://example.com/',
  'https://other.test/',
]

describe('the Chrome PAC for a rule with the proxy scope fields', () => {
  it('routes each host the same as the PAC for the rule without them', () => {
    const withFields = pacFor(scopedRule)
    const withoutFields = pacFor(plainRule)

    for (const url of requestUrls) {
      expect(evaluatePac(withFields, url)).toBe(evaluatePac(withoutFields, url))
    }
  })

  it('still proxies the matched hosts, so the comparison is not two direct routes', () => {
    const pac = pacFor(scopedRule)

    expect(evaluatePac(pac, 'https://a.example.com/x')).toBe(PROXY_ROUTE)
    expect(evaluatePac(pac, 'https://other.test/')).toBe('DIRECT')
  })
})
