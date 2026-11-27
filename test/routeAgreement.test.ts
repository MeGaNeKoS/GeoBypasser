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
  { name: 'typed', match: ['*://typed.scope.invalid/*'], proxyId: 'good', proxyOnlyResourceTypes: ['image'] },
  { name: 'untyped', match: ['*://untyped.scope.invalid/*'], proxyId: 'good', proxyOnlyResourceTypes: [] },
  { name: 'paged', match: ['*://paged.scope.invalid/*'], proxyId: 'good', proxyOnlyPageHostnames: ['site.example'] },
  { name: 'typed force', match: ['*://*.typed-force.scope.invalid/*'], proxyId: 'good', proxyOnlyResourceTypes: ['image'], forceProxyUrlPatterns: ['*://forced.typed-force.scope.invalid/*'] },
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
  type?: string;
  documentUrl?: string;
  firefoxOnly?: boolean;
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
  { name: 'a static extension on http', url: 'http://static.example.net/a.png', expected: DIRECT },
  { name: 'a static extension on https, which Chrome cannot match', url: 'https://static.example.net/a.png', expected: DIRECT, firefoxOnly: true },
  { name: 'a static extension with a query on https', url: 'https://static.example.net/a.png?v=2', expected: DIRECT, firefoxOnly: true },
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
  { name: 'a resource type the rule does not list', url: 'https://typed.scope.invalid/x', type: 'script', expected: DIRECT, firefoxOnly: true },
  { name: 'a resource type the rule lists', url: 'https://typed.scope.invalid/logo.png', type: 'image', expected: GOOD, firefoxOnly: true },
  { name: 'an empty resource type list', url: 'https://untyped.scope.invalid/x', type: 'script', expected: GOOD, firefoxOnly: true },
  { name: 'a page off the listed hosts', url: 'https://paged.scope.invalid/x', documentUrl: 'https://elsewhere.example/', expected: DIRECT, firefoxOnly: true },
  { name: 'a page on a subdomain of a listed host', url: 'https://paged.scope.invalid/x', documentUrl: 'https://news.site.example/', expected: GOOD, firefoxOnly: true },
  { name: 'a request with no page', url: 'https://paged.scope.invalid/x', expected: DIRECT, firefoxOnly: true },
  { name: 'a force pattern over a resource type limit', url: 'https://forced.typed-force.scope.invalid/x', type: 'script', expected: GOOD, firefoxOnly: true },
  { name: 'a resource type limit on a host outside the force pattern', url: 'https://plain.typed-force.scope.invalid/x', type: 'script', expected: DIRECT, firefoxOnly: true },
]

function chromePacUrl (url: string): string {
  const parsed = new URL(url)
  return parsed.protocol === 'https:' ? `${parsed.origin}/` : url
}

async function firefoxRoute (row: Row): Promise<string> {
  browser.tabs.get.mockResolvedValue({ id: 1, url: row.url })
  const requestInfo = {
    url: row.url,
    type: row.type ?? 'main_frame',
    tabId: 1,
    documentUrl: row.documentUrl,
  } as Proxy.OnRequestDetailsType
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

  it.each(rows.filter(row => !row.firefoxOnly))('routes $name the same way on both browsers', async row => {
    expect(await firefoxRoute(row)).toBe(row.expected)
    expect(evaluatePac(generatePacScript(configFor(row)), chromePacUrl(row.url))).toBe(row.expected)
  })

  it.each(rows.filter(row => row.firefoxOnly))('routes $name on Firefox, where the rule option applies', async row => {
    expect(await firefoxRoute(row)).toBe(row.expected)
  })

  it('leaves an https static extension to the proxy on Chrome, because the PAC never sees its path', () => {
    const pac = generatePacScript(config)
    expect(evaluatePac(pac, 'https://static.example.net/a.png')).toBe(GOOD)
    expect(evaluatePac(pac, 'http://static.example.net/a.png')).toBe(DIRECT)
  })
})
