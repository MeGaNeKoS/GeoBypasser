import { makeDomainProxyHandler, makeProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import { browser } from './setup'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const good: ProxyListItem = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false } as any
const fallback: ProxyListItem = { id: 'fallback', type: 'http', host: 'fallback.lan', port: 3128, proxyDNS: false } as any
const setAsideProxy: ProxyListItem = {
  id: 'bad', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false,
} as any

const goodRule: ProxyRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' } as any
const setAsideRule: any = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good' }
const setAsideProxyRule: any = { active: true, name: 'bad proxy', match: ['https://example.org/*'], proxyId: 'bad' }
const missingProxyRule: any = { active: true, name: 'gone', match: ['https://example.org/*'], proxyId: 'gone' }

function config (rules: unknown[], proxyList: ProxyListItem[], defaultProxy?: string): any {
  return {
    proxyList,
    defaultProxy,
    fallbackDirect: false,
    testProxyUrl: 'https://www.google.com/',
    rules: compileRules(rules as ProxyRule[]),
    perWebsiteOverride: {},
    keepAliveRules: {},
  }
}

function overrideConfig (perWebsiteOverride: Record<string, unknown>): any {
  return {
    proxyList: [good, fallback],
    defaultProxy: 'fallback',
    fallbackDirect: false,
    testProxyUrl: 'https://www.google.com/',
    rules: [],
    perWebsiteOverride,
    keepAliveRules: {},
  }
}

async function route (cfg: any, url: string) {
  return makeProxyHandler(cfg)({ url, type: 'main_frame', tabId: -1 } as any)
}

async function routeDomain (cfg: any) {
  ;(browser.tabs.get as jest.Mock).mockResolvedValue({ id: 1, url: 'https://example.com/a' })
  return makeDomainProxyHandler(cfg, browser.tabs.get)({ url: 'https://example.com/a', type: 'main_frame', tabId: 1 } as any)
}

const urls = ['https://example.com/a', 'https://example.org/b', 'https://other.test/']

describe('set aside entries route as if they were deleted', () => {
  it('gives the same routing as the config with the set aside rule deleted', async () => {
    const withEntry = config([setAsideRule, goodRule], [good, fallback], 'fallback')
    const without = config([goodRule], [good, fallback], 'fallback')
    for (const url of urls) {
      expect(await route(withEntry, url)).toEqual(await route(without, url))
    }
  })

  it('never returns the host of a set aside proxy', async () => {
    const cfg = config([setAsideProxyRule], [setAsideProxy, good], 'good')
    const res = await route(cfg, 'https://example.org/b')
    expect(JSON.stringify(res ?? [])).not.toContain('a:1; PROXY x:8080')
  })

  it('routes a rule with a set aside proxy as a rule with a missing proxy does', async () => {
    const setAside = config([setAsideProxyRule], [setAsideProxy, fallback], 'fallback')
    const missing = config([missingProxyRule], [setAsideProxy, fallback], 'fallback')
    expect(await route(setAside, 'https://example.org/b')).toEqual(
      await route(missing, 'https://example.org/b'),
    )
    expect(await route(setAside, 'https://example.org/b')).toEqual([
      expect.objectContaining({ host: 'fallback.lan' }),
    ])
  })
})

describe('website overrides that are set aside', () => {
  it('does not route to the default proxy for an override whose value is an object', async () => {
    expect(await routeDomain(overrideConfig({ 'example.com': {} }))).toBeUndefined()
  })

  it('does not route to the default proxy for an override whose value is null', async () => {
    expect(await routeDomain(overrideConfig({ 'example.com': null }))).toBeUndefined()
  })

  it('ignores an override whose domain is not valid, as if it were deleted', async () => {
    expect(await routeDomain(overrideConfig({ 'bad domain.example': 'good', 'example.com': null }))).toBeUndefined()
  })
})
