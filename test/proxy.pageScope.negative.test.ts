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

async function decisionOf (config: GeoBypassRuntimeSettings, request: object): Promise<RouteDecision> {
  const decisions: RouteDecision[] = []
  await makeProxyHandler(config, (_requestInfo, decision) => decisions.push(decision))(request as any)
  return decisions[0]
}

describe('a rule limited to a page sends other pages direct, named as outside its limits', () => {
  it('sends a main_frame navigation to another host direct with reason outsideScope', async () => {
    const decision = await decisionOf(configLimitedTo('test-site.example'), {
      url: 'https://elsewhere.example/',
      type: 'main_frame',
      tabId: 1,
    })

    expect(decision).toMatchObject({ reason: 'outsideScope', rule: { name: 'site only' } })
  })

  it('sends a subresource of another page direct with reason outsideScope', async () => {
    const decision = await decisionOf(configLimitedTo('test-site.example'), {
      url: 'https://cdn.example/app.js',
      type: 'script',
      tabId: 1,
      documentUrl: 'https://elsewhere.example/',
    })

    expect(decision.reason).toBe('outsideScope')
  })
})
