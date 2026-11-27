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

describe('a staticExtensions pattern with the g flag', () => {
  it('gives the same answer every time for the same URL', async () => {
    const cfg = config('/\\.png$/g')
    const first = await route(cfg, 'https://example.com/a.png')
    const second = await route(cfg, 'https://example.com/a.png')
    const third = await route(cfg, 'https://example.com/a.png')
    expect(first).toEqual([{ type: 'direct' }])
    expect(second).toEqual([{ type: 'direct' }])
    expect(third).toEqual([{ type: 'direct' }])
  })
})
