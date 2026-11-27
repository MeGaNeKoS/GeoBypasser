import { generatePacScript } from '@utils/pac'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const good: ProxyListItem = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false } as any
const setAsideHost: ProxyListItem = {
  id: 'bad', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false,
} as any

const goodRule: ProxyRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' } as any
const setAsideRule: any = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good' }
const setAsideProxyRule: any = { active: true, name: 'bad proxy', match: ['https://example.org/*'], proxyId: 'bad' }

function config (rules: unknown[], proxyList: ProxyListItem[]): any {
  return {
    proxyList,
    defaultProxy: 'good',
    fallbackDirect: false,
    testProxyUrl: 'https://www.google.com/',
    rules: compileRules(rules as ProxyRule[]),
    perWebsiteOverride: {},
    keepAliveRules: {},
  }
}

function overrideConfig (perWebsiteOverride: Record<string, unknown>): any {
  return {
    proxyList: [good],
    defaultProxy: 'good',
    fallbackDirect: false,
    testProxyUrl: 'https://www.google.com/',
    rules: compileRules([]),
    perWebsiteOverride,
    keepAliveRules: {},
  }
}

describe('PAC script with set aside entries', () => {
  it('equals the PAC script of the config with those entries deleted', () => {
    const withEntries = config([setAsideRule, goodRule, setAsideProxyRule], [setAsideHost, good])
    const deleted = config([goodRule, setAsideProxyRule], [good])
    expect(generatePacScript(withEntries)).toBe(generatePacScript(deleted))
  })

  it('contains no line for a set aside pattern or host', () => {
    const pac = generatePacScript(config([setAsideRule, setAsideProxyRule, goodRule], [setAsideHost, good]))
    expect(pac).not.toContain('not a pattern')
    expect(pac).not.toContain('a:1; PROXY x:8080')
    expect(pac).toContain('good.lan')
  })
})

describe('PAC script with website overrides that are set aside', () => {
  it('equals the PAC script of the config with those overrides deleted', () => {
    const withEntries = overrideConfig({ 'example.com': {}, 'bad domain.example': 'good', 'other.example': null })
    const deleted = overrideConfig({})
    expect(generatePacScript(withEntries)).toBe(generatePacScript(deleted))
  })
})
