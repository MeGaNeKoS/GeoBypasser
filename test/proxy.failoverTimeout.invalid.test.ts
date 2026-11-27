import { failoverTimeoutFor, makeDefaultProxyHandler, makeProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const proxyWith = (failoverTimeout: unknown): ProxyListItem => ({
  id: 'p1',
  type: 'socks',
  host: 'h',
  port: 1080,
  proxyDNS: true,
  failoverTimeout: failoverTimeout as number,
})
const rule = { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1' } as ProxyRule

function configWith (proxy: ProxyListItem): GeoBypassRuntimeSettings {
  return {
    proxyList: [proxy],
    defaultProxy: proxy.id,
    fallbackDirect: false,
    testProxyUrl: 'https://t/',
    rules: compileRules([rule]),
    perWebsiteOverride: {},
  }
}

describe('a stored failover timeout that is not a whole number of seconds, 1 or more, never reaches the browser', () => {
  it.each([0, -5, 2.5, '12'])('is omitted from the rule handler result for %p', async value => {
    const res = await makeProxyHandler(configWith(proxyWith(value)))(
      { url: 'https://example.com/a', type: 'main_frame', tabId: -1 } as any)
    expect(res).toEqual([expect.anything()])
    expect(res![0]).not.toHaveProperty('failoverTimeout')
  })

  it.each([0, -5, 2.5, '12'])('is omitted from the default handler result for %p', async value => {
    const res = await makeDefaultProxyHandler(configWith(proxyWith(value)))()
    expect(res).toEqual([expect.anything()])
    expect(res![0]).not.toHaveProperty('failoverTimeout')
  })

  it.each([0, -5, 2.5, '12'])('gives failoverTimeoutFor no value for %p', value => {
    expect(failoverTimeoutFor(proxyWith(value))).toBeUndefined()
  })
})
