import { makeProxyHandler, type RouteDecision } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem } from '@customTypes/proxy'

const proxy: ProxyListItem = { id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true }

function configLimitedTo (pageHostname: string): GeoBypassRuntimeSettings {
  return {
    proxyList: [proxy],
    defaultProxy: undefined,
    fallbackDirect: false,
    testProxyUrl: 'https://t/',
    rules: compileRules([
      { active: true, name: 'site only', match: ['<all_urls>'], proxyId: 'p1', proxyOnlyPageHostnames: [pageHostname] },
    ]),
    perWebsiteOverride: {},
  }
}

async function routeOf (config: GeoBypassRuntimeSettings, request: object) {
  const decisions: RouteDecision[] = []
  const handler = makeProxyHandler(config, (_requestInfo, decision) => decisions.push(decision))
  const proxyInfo = await handler(request as any)
  return { proxyInfo, decision: decisions[0] }
}

describe('a rule limited to a page routes that page top level navigation through its proxy', () => {
  it('uses the request url as the page of a main_frame request', async () => {
    const { proxyInfo, decision } = await routeOf(configLimitedTo('test-site.example'), {
      url: 'https://test-site.example/',
      type: 'main_frame',
      tabId: 1,
    })

    expect(decision.reason).toBe('rule')
    expect(proxyInfo).toEqual([expect.objectContaining({ host: 'h', port: 80 })])
  })

  it('routes a subresource whose document is the listed page', async () => {
    const { decision } = await routeOf(configLimitedTo('test-site.example'), {
      url: 'https://cdn.example/app.js',
      type: 'script',
      tabId: 1,
      documentUrl: 'https://test-site.example/',
    })

    expect(decision.reason).toBe('rule')
  })
})
