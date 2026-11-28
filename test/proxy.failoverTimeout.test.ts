import { failoverTimeoutFor, makeDefaultProxyHandler, makeProxyHandler, makeTabProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const STORED_FAILOVER_TIMEOUT_SECONDS = 12

const proxy: ProxyListItem = {
  id: 'p1',
  type: 'socks',
  host: 'h',
  port: 1080,
  proxyDNS: true,
  failoverTimeout: STORED_FAILOVER_TIMEOUT_SECONDS,
}
const rule = { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1' } as ProxyRule

function configWith (): GeoBypassRuntimeSettings {
  return {
    proxyList: [proxy],
    defaultProxy: proxy.id,
    fallbackDirect: false,
    testProxyUrl: 'https://t/',
    rules: compileRules([rule]),
    perWebsiteOverride: {},
  }
}

describe('stored failover timeout reaches the routing result', () => {
  it('is carried by the rule handler', async () => {
    const res = await makeProxyHandler(configWith())(
      { url: 'https://example.com/a', type: 'main_frame', tabId: -1 } as any)
    expect(res).toEqual([expect.objectContaining({ failoverTimeout: STORED_FAILOVER_TIMEOUT_SECONDS })])
  })

  it('is carried by the tab handler', async () => {
    const handler = makeTabProxyHandler(configWith(), { 1: 'p1' })
    const res = await handler({ tabId: 1, url: 'https://x', type: 'script' } as any)
    expect(res?.proxyInfo).toEqual([expect.objectContaining({ failoverTimeout: STORED_FAILOVER_TIMEOUT_SECONDS })])
  })

  it('is carried by the default handler', async () => {
    const res = await makeDefaultProxyHandler(configWith())()
    expect(res?.proxyInfo).toEqual([expect.objectContaining({ failoverTimeout: STORED_FAILOVER_TIMEOUT_SECONDS })])
  })

  it('is the value failoverTimeoutFor returns', () => {
    expect(failoverTimeoutFor(proxy)).toBe(STORED_FAILOVER_TIMEOUT_SECONDS)
  })
})
