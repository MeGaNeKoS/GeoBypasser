import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript } from '@utils/pac'
import { pacRouteFor } from '@utils/pacRoute'
import { makeDefaultProxyHandler, makeDomainProxyHandler, makeProxyHandler } from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { Proxy } from 'webextension-polyfill'
import { evaluatePac } from './pacEvaluation'
import { browser } from './setup'

const GOOD = 'PROXY good.lan:8080'
const OTHER = 'PROXY other.lan:3128'
const DIRECT = 'DIRECT'

const proxyList = [
  { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false },
  { id: 'other', type: 'http', host: 'other.lan', port: 3128, proxyDNS: false },
  { id: 'broken', type: 'http', host: 'broken.lan', port: 0, proxyDNS: false },
] as ProxyListItem[]

const rules = [
  { name: 'wildcard', match: ['*://*.test/*'], proxyId: 'good', bypassUrlPatterns: ['*://bypass.test/*'] },
  { name: 'subdomain', match: ['*://*.example.com/*'], proxyId: 'good' },
  { name: 'force', match: ['*://*.example.org/*'], proxyId: 'good', bypassUrlPatterns: ['*://*.example.org/*'], forceProxyUrlPatterns: ['*://forced.example.org/*'] },
  { name: 'static', match: ['*://static.example.net/*'], proxyId: 'good', staticExtensions: '/\\.(png|js)$/i' },
  { name: 'path', match: ['*://pathy.example.io/a/*'], proxyId: 'good' },
  { name: 'missing proxy', match: ['*://*.gone.example.net/*'], proxyId: 'gone' },
  { name: 'set-aside proxy', match: ['*://*.broken.example.net/*'], proxyId: 'broken' },
] as ProxyRule[]

const config = {
  proxyList,
  defaultProxy: 'other',
  fallbackDirect: false,
  rules: compileRules(rules),
  perWebsiteOverride: {
    'example.com': 'good',
    'sub.example.com': 'other',
    'override.test': 'other',
    '[::1]': 'good',
    'dot.example.net.': 'good',
    'Mixed.Example.NET': 'good',
  },
  keepAliveRules: {},
} as unknown as GeoBypassRuntimeSettings

const configWithoutDefaultProxy: GeoBypassRuntimeSettings = { ...config, defaultProxy: undefined }

type Row = {
  name: string;
  url: string;
  expected: string;
  noDefaultProxy?: boolean;
}

function configFor (row: Row): GeoBypassRuntimeSettings {
  return row.noDefaultProxy ? configWithoutDefaultProxy : config
}

const rows: Row[] = [
  { name: 'a host spoofed in the path', url: 'http://evil.com/x.example.com/y', expected: OTHER },
  { name: 'a scheme the pattern excludes', url: 'ftp://a.test/x', expected: OTHER },
  { name: 'a port on the named host', url: 'https://a.example.com:8443/x', expected: GOOD },
  { name: 'a subdomain of the named host', url: 'https://a.b.example.com/x', expected: GOOD },
  { name: 'a pattern with a path, on another path', url: 'https://pathy.example.io/b/c', expected: GOOD },
  { name: 'a force pattern over a bypass', url: 'https://forced.example.org/x', expected: GOOD },
  { name: 'a bypass pattern with a default proxy set', url: 'https://plain.example.org/x', expected: DIRECT },
  { name: 'a bypass url pattern with a default proxy set', url: 'https://bypass.test/x', expected: DIRECT },
  { name: 'a static extension with a default proxy set', url: 'https://static.example.net/a.png', expected: DIRECT },
  { name: 'a static extension with a query', url: 'https://static.example.net/a.png?v=2', expected: DIRECT },
  { name: 'a non-static path on the static host', url: 'https://static.example.net/page', expected: GOOD },
  { name: 'an override on the tab host beats a rule', url: 'https://override.test/x', expected: OTHER },
  { name: 'an override matches its domain exactly', url: 'https://example.com/', expected: GOOD },
  { name: 'the most specific override wins', url: 'https://x.sub.example.com/', expected: OTHER },
  { name: 'an override does not match a host that only ends with it', url: 'https://notexample.com/', expected: OTHER },
  { name: 'a rule whose proxy is missing, with a default proxy set', url: 'https://a.gone.example.net/x', expected: OTHER },
  { name: 'a rule whose proxy is missing, with no default proxy', url: 'https://a.gone.example.net/x', expected: DIRECT, noDefaultProxy: true },
  { name: 'a rule whose proxy is set aside, with a default proxy set', url: 'https://a.broken.example.net/x', expected: OTHER },
  { name: 'a rule whose proxy is set aside, with no default proxy', url: 'https://a.broken.example.net/x', expected: DIRECT, noDefaultProxy: true },
  { name: 'an override with a bracketed IPv6 key', url: 'http://[::1]:8080/x', expected: GOOD },
  { name: 'an override with a trailing dot in its key', url: 'https://dot.example.net./x', expected: GOOD },
  { name: 'an override with an uppercase key on a lowercase host', url: 'https://mixed.example.net/x', expected: GOOD },
]

async function firefoxRoute (row: Row): Promise<string> {
  browser.tabs.get.mockResolvedValue({ id: 1, url: row.url })
  const requestInfo = { url: row.url, type: 'main_frame', tabId: 1 } as Proxy.OnRequestDetailsType
  const runtimeConfig = configFor(row)
  const handlers = [makeDomainProxyHandler(runtimeConfig, browser.tabs.get),makeProxyHandler(runtimeConfig), makeDefaultProxyHandler(runtimeConfig)]
  for (const handler of handlers) {
    const result = await handler(requestInfo)
    if (result !== undefined) return toPacRoute(result)
  }
  return DIRECT
}

type FirefoxRoute = { type: string; host?: string; port?: number }
type EndpointRoute = FirefoxRoute & { host: string; port: number }

function isEndpointRoute (route: FirefoxRoute): route is EndpointRoute {
  return route.host !== undefined && route.port !== undefined
}

function routeToPac (route: FirefoxRoute): string {
  if (route.type === 'direct') return DIRECT
  if (!isEndpointRoute(route)) throw new Error(`route of type ${route.type} has no endpoint`)
  return pacRouteFor(route)
}

function toPacRoute (routes: FirefoxRoute[]): string {
  return routes.map(routeToPac).join('; ')
}

describe('a route table run through the Firefox handlers and the Chrome PAC script', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(rows)('routes $name the same way on both browsers', async row => {
    expect(await firefoxRoute(row)).toBe(row.expected)
    expect(evaluatePac(generatePacScript(configFor(row)), row.url)).toBe(row.expected)
  })
})
