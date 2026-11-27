import { failoverTimeoutFor, makeDefaultProxyHandler } from '@utils/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem } from '@customTypes/proxy'

const AUTHENTICATED_HTTP_PROBE_SECONDS = 30
const OTHER_PROXY_PROBE_SECONDS = 3

const base = { id: 'p1', host: 'h', port: 8080, proxyDNS: true }

function defaultRouteFor (proxy: ProxyListItem): Promise<unknown> {
  const config: GeoBypassRuntimeSettings = {
    proxyList: [proxy],
    defaultProxy: proxy.id,
    fallbackDirect: false,
    testProxyUrl: 'https://t/',
    rules: [],
    perWebsiteOverride: {},
  }
  return makeDefaultProxyHandler(config)()
}

describe('failover timeout when none is stored', () => {
  it('routing leaves the field unset for an authenticated http proxy', async () => {
    const proxy: ProxyListItem = { ...base, type: 'http', username: 'user' }
    const [routed] = (await defaultRouteFor(proxy)) as object[]
    expect(routed).not.toHaveProperty('failoverTimeout')
  })

  it('routing leaves the field unset for an unauthenticated http proxy', async () => {
    const proxy: ProxyListItem = { ...base, type: 'http' }
    const [routed] = (await defaultRouteFor(proxy)) as object[]
    expect(routed).not.toHaveProperty('failoverTimeout')
  })

  it('the connection test probes an authenticated http proxy for 30 seconds', () => {
    expect(failoverTimeoutFor({ ...base, type: 'http', username: 'user' })).toBe(AUTHENTICATED_HTTP_PROBE_SECONDS)
  })

  it('the connection test probes any other proxy for 3 seconds', () => {
    expect(failoverTimeoutFor({ ...base, type: 'http' })).toBe(OTHER_PROXY_PROBE_SECONDS)
    expect(failoverTimeoutFor({ ...base, type: 'socks', username: 'user' })).toBe(OTHER_PROXY_PROBE_SECONDS)
  })
})
