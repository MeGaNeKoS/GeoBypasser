import type { ProxyRule } from '@customTypes/proxy'
import { expectedRoute, type ExpectedRoute } from '@utils/expectedRoute'
import { DIRECT, PROXY_GOOD, PROXY_OTHER, pacRouteOracle, settingsFor } from './chromePacOracle'

const exampleRule: ProxyRule = {
  active: true,
  name: 'example',
  match: ['*://*.example.com/*'],
  proxyId: 'good',
} as ProxyRule

const rows: Array<[string, ReturnType<typeof settingsFor>, string, ExpectedRoute]> = [
  [
    'a site proxy for the exact host',
    settingsFor({ overrides: { 'example.com': 'other' } }),
    'https://example.com/x',
    { route: PROXY_OTHER, reason: 'site' },
  ],
  [
    'a site proxy for a subdomain of the host',
    settingsFor({ overrides: { 'example.com': 'other' } }),
    'https://a.example.com/x',
    { route: PROXY_OTHER, reason: 'site' },
  ],
  [
    'a site proxy beats a rule that also matches',
    settingsFor({ rules: [exampleRule], overrides: { 'a.example.com': 'other' } }),
    'https://a.example.com/x',
    { route: PROXY_OTHER, reason: 'site' },
  ],
  [
    'a rule match with its proxy',
    settingsFor({ rules: [exampleRule] }),
    'https://a.example.com/x',
    { route: PROXY_GOOD, reason: 'rule', ruleName: 'example' },
  ],
  [
    'a rule whose proxy is direct',
    settingsFor({ rules: [{ ...exampleRule, proxyId: 'direct' } as ProxyRule] }),
    'https://a.example.com/x',
    { route: DIRECT, reason: 'rule', ruleName: 'example' },
  ],
  [
    'a rule with fallback direct',
    settingsFor({ rules: [{ ...exampleRule, fallbackDirect: true } as ProxyRule] }),
    'https://a.example.com/x',
    { route: `${PROXY_GOOD}; DIRECT`, reason: 'rule', ruleName: 'example' },
  ],
  [
    'a force pattern beats a bypass pattern for the same URL',
    settingsFor({
      rules: [{
        ...exampleRule,
        bypassUrlPatterns: ['*://*.example.com/*'],
        forceProxyUrlPatterns: ['*://a.example.com/x*'],
      } as ProxyRule],
    }),
    'http://a.example.com/x',
    { route: PROXY_GOOD, reason: 'rule', ruleName: 'example' },
  ],
  [
    'a bypass pattern on an http URL',
    settingsFor({
      rules: [{ ...exampleRule, bypassUrlPatterns: ['*://*.example.com/private/*'] } as ProxyRule],
    }),
    'http://a.example.com/private/x',
    { route: DIRECT, reason: 'bypass', ruleName: 'example' },
  ],
  [
    'a static extension on an http URL',
    settingsFor({
      rules: [{ ...exampleRule, staticExtensions: '/\\.(png|jpg)$/i' } as ProxyRule],
    }),
    'http://a.example.com/logo.PNG',
    { route: DIRECT, reason: 'staticExtension', ruleName: 'example' },
  ],
  [
    'the default proxy when nothing matches',
    settingsFor({ defaultProxy: 'other' }),
    'https://unrelated.test/',
    { route: PROXY_OTHER, reason: 'default' },
  ],
  [
    'the default proxy with fallback direct',
    settingsFor({ fallbackDirect: true, defaultProxy: 'good' }),
    'https://unrelated.test/',
    { route: `${PROXY_GOOD}; DIRECT`, reason: 'default' },
  ],
]

describe('expectedRoute matches the Chrome PAC route', () => {
  it.each(rows)('for %s', (_name, settings, url, expected) => {
    const route = expectedRoute(settings, url)

    expect(route).toEqual(expected)
    expect(route.route).toBe(pacRouteOracle(settings, url))
  })
})
