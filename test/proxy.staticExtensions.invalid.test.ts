import { makeProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const good: ProxyListItem = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false } as any

function config (staticExtensions?: string): any {
  const rule: ProxyRule = {
    active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'good', staticExtensions,
  } as any
  return {
    proxyList: [good],
    defaultProxy: 'good',
    fallbackDirect: false,
    testProxyUrl: 'https://www.google.com/',
    rules: compileRules([rule]),
    perWebsiteOverride: {},
    keepAliveRules: {},
  }
}

async function route (cfg: any, url: string) {
  return makeProxyHandler(cfg)({ url, type: 'image', tabId: -1 } as any)
}

describe('a staticExtensions value that is not valid', () => {
  it('routes as if the rule had no staticExtensions value', async () => {
    const bad = config('/(/')
    const none = config(undefined)
    expect(await route(bad, 'https://example.com/a.png')).toEqual(await route(none, 'https://example.com/a.png'))
    expect(await route(bad, 'https://example.com/a.png')).toEqual([
      expect.objectContaining({ host: 'good.lan' }),
    ])
  })

  it('treats the flags g and gg the same as a value without slashes', async () => {
    const repeated = config('/x/gg')
    expect(await route(repeated, 'https://example.com/x')).toEqual([
      expect.objectContaining({ host: 'good.lan' }),
    ])
  })
})
