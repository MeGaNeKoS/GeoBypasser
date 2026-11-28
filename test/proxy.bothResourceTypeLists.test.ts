import { makeProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const good: ProxyListItem = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false } as any

function configWithBothLists (): any {
  const rule: ProxyRule = {
    active: true,
    name: 'both',
    match: ['https://example.com/*'],
    proxyId: 'good',
    bypassResourceTypes: ['image'],
    proxyOnlyResourceTypes: ['image', 'media'],
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

async function routeType (type: string) {
  return makeProxyHandler(configWithBothLists())({
    url: 'https://example.com/asset',
    type,
    tabId: 1,
    documentUrl: 'https://example.com/',
  } as any)
}

describe('a rule that stores both resource type lists', () => {
  it('connects directly a type that is in both lists', async () => {
    expect(await routeType('image')).toEqual([{ type: 'direct' }])
  })

  it('proxies a type that is only in the only-proxy list', async () => {
    expect(await routeType('media')).toEqual([{ ...good, proxyDNS: false }])
  })

  it('connects directly a type that is in neither list', async () => {
    expect(await routeType('script')).toEqual([{ type: 'direct' }])
  })
})
