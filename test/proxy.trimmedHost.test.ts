import { makeProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const padded: ProxyListItem = { id: 'good', type: 'http', host: ' good.lan ', port: 8080, proxyDNS: false } as any
const rule: ProxyRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' } as any

describe('proxy with whitespace around its host', () => {
  it('routes with the trimmed host', async () => {
    const cfg: any = {
      proxyList: [padded],
      defaultProxy: 'good',
      fallbackDirect: false,
      testProxyUrl: 'https://www.google.com/',
      rules: compileRules([rule]),
      perWebsiteOverride: {},
      keepAliveRules: {},
    }
    const res = await makeProxyHandler(cfg)({ url: 'https://example.com/a', type: 'main_frame', tabId: -1 } as any)
    expect(res).toEqual([expect.objectContaining({ host: 'good.lan' })])
    expect(cfg.proxyList[0].host).toBe(' good.lan ')
  })
})
