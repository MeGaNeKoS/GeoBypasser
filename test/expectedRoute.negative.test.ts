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
    'an inactive rule that matches',
    settingsFor({ rules: [{ ...exampleRule, active: false } as ProxyRule], defaultProxy: 'other' }),
    'https://a.example.com/x',
    { route: PROXY_OTHER, reason: 'default' },
  ],
  [
    'a rule that does not match the host',
    settingsFor({ rules: [exampleRule], defaultProxy: 'other' }),
    'https://other.test/',
    { route: PROXY_OTHER, reason: 'default' },
  ],
  [
    'a site proxy that does not resolve, falling back to the default proxy',
    settingsFor({ overrides: { 'example.com': 'missing' }, defaultProxy: 'other' }),
    'https://a.example.com/x',
    { route: PROXY_OTHER, reason: 'site' },
  ],
  [
    'a site proxy that does not resolve and no default proxy',
    settingsFor({ overrides: { 'example.com': 'missing' } }),
    'https://a.example.com/x',
    { route: DIRECT, reason: 'default' },
  ],
  [
    'a rule proxy that does not resolve and no default proxy',
    settingsFor({ rules: [{ ...exampleRule, proxyId: 'missing' } as ProxyRule] }),
    'https://a.example.com/x',
    { route: DIRECT, reason: 'rule', ruleName: 'example' },
  ],
  [
    'a static extension under https, which the Chrome PAC cannot see',
    settingsFor({
      rules: [{ ...exampleRule, staticExtensions: '/\\.(png|jpg)$/i' } as ProxyRule],
    }),
    'https://a.example.com/logo.png',
    { route: PROXY_GOOD, reason: 'rule', ruleName: 'example' },
  ],
  [
    'a Firefox-only resource type and page scope, which the PAC does not evaluate',
    settingsFor({
      rules: [{
        ...exampleRule,
        proxyOnlyResourceTypes: ['image'],
        proxyOnlyPageHostnames: ['site.example'],
      } as ProxyRule],
    }),
    'https://a.example.com/logo.png',
    { route: PROXY_GOOD, reason: 'rule', ruleName: 'example' },
  ],
]

describe('expectedRoute matches the Chrome PAC route where a rule does not apply', () => {
  it.each(rows)('for %s', (_name, settings, url, expected) => {
    const route = expectedRoute(settings, url)

    expect(route).toEqual(expected)
    expect(route.route).toBe(pacRouteOracle(settings, url))
  })

  it('matches the Chrome PAC route for a path bypass pattern under https', () => {
    const settings = settingsFor({
      rules: [{ ...exampleRule, bypassUrlPatterns: ['*://*.example.com/private/*'] } as ProxyRule],
    })
    const url = 'https://a.example.com/private/x'

    expect(expectedRoute(settings, url).route).toBe(pacRouteOracle(settings, url))
  })
})
