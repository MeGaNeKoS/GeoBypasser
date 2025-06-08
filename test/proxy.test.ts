import {
  makeDefaultProxyHandler,
  makeDomainProxyHandler,
  makeProxyHandler,
  makeTabProxyHandler,
  testProxyConfigQueued,
} from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { browser } from './setup'
import type { ProxyListItem } from '@customTypes/proxy'

beforeEach(() => {
  jest.clearAllMocks()
})

const proxy: ProxyListItem = { id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true }

function baseConfig (): GeoBypassRuntimeSettings {
  return {
    proxyList: [proxy],
    defaultProxy: undefined,
    fallbackDirect: true,
    testProxyUrl: 'https://t/',
    rules: [],
    perWebsiteOverride: {},
  }
}

describe('makeTabProxyHandler', () => {
  it('maps by tab id and appends direct', async () => {
    const handler = makeTabProxyHandler(baseConfig(), { 1: 'p1' })
    const res = await handler({ tabId: 1, url: 'https://x', type: 'script' } as any)
    expect(res).toEqual([{ ...proxy, proxyDNS: false }, { type: 'direct' }])
  })
})

describe('makeDomainProxyHandler', () => {
  it('resolves override by hostname', async () => {
    const cfg = baseConfig()
    cfg.perWebsiteOverride = { 'example.com': 'p1' }
    browser.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com/path' })
    const res = await makeDomainProxyHandler(cfg)({ tabId: 1 } as any)
    expect(res).toEqual([{ ...proxy, proxyDNS: false }, { type: 'direct' }])
  })

  it('warns when proxy missing', async () => {
    const cfg = baseConfig()
    cfg.perWebsiteOverride = { 'example.com': 'missing' }
    browser.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com' })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await makeDomainProxyHandler(cfg)({ tabId: 1 } as any)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('makeProxyHandler', () => {
  const cfg = baseConfig()
  cfg.rules = compileRules([
    {
      active: true,
      name: 'r',
      match: ['<all_urls>'],
      forceProxyUrlPatterns: ['https://force/*'],
      bypassUrlPatterns: ['https://bypass/*'],
      bypassRequestTypes: ['image'],
      staticExtensions: '/\\.jpg$/',
      fallbackDirect: true,
      proxyId: 'p1',
    },
  ])
  const handler = makeProxyHandler(cfg)

  it('uses force proxy patterns', async () => {
    const res = await handler({ url: 'https://force/1', type: 'script' } as any)
    expect(res).toEqual([{ ...proxy, proxyDNS: false }, { type: 'direct' }])
  })

  it('bypasses via url pattern', async () => {
    const res = await handler({ url: 'https://bypass/1', type: 'script' } as any)
    expect(res).toBeUndefined()
  })

  it('bypasses via request type', async () => {
    const res = await handler({ url: 'https://x/1', type: 'image' } as any)
    expect(res).toBeUndefined()
  })

  it('bypasses via static extension', async () => {
    const res = await handler({ url: 'https://x/1.jpg', type: 'script' } as any)
    expect(res).toBeUndefined()
  })
})

describe('makeDefaultProxyHandler', () => {
  it('returns default proxy or warns', async () => {
    const cfg = baseConfig()
    cfg.defaultProxy = 'p1'
    let res = await makeDefaultProxyHandler(cfg)()
    expect(res).toEqual([{ ...proxy, proxyDNS: false }, { type: 'direct' }])
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    cfg.defaultProxy = undefined
    res = await makeDefaultProxyHandler(cfg)()
    expect(res).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('testProxyConfigQueued', () => {
  it('processes queued tests sequentially', async () => {
    const fetchSpy = jest.spyOn(require('@utils/generic'), 'fetchWithTimeout').mockResolvedValue({ ok: true } as any)
    const results: string[] = []
    await testProxyConfigQueued(proxy, 'https://t', r => { results.push('1') })
    await testProxyConfigQueued(proxy, 'https://t', r => { results.push('2') })
    await Promise.resolve()
    await Promise.resolve()
    expect(results).toEqual(['1', '2'])
    fetchSpy.mockRestore()
  })
})
