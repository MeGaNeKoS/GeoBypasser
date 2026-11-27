import { homeViewFor, keepAliveRulesPhrase } from '@utils/homeView'
import type { HomeInput } from '@utils/homeView'

const tokyo = { id: 'p1', type: 'http', host: 'tokyo.example', port: 8080, proxyDNS: false, label: 'Tokyo SOCKS' }

function input (settings: Partial<HomeInput['settings']>): HomeInput {
  return {
    settings: { proxyList: [], rules: [], perWebsiteOverride: {}, keepAliveRules: {}, ...settings },
    tabProxyMap: {},
    browser: 'firefox',
  }
}

describe('homeViewFor zero values', () => {
  it('reads an empty site list and an empty rule list as no sites and no rules', () => {
    const view = homeViewFor(input({ proxyList: [tokyo] }))

    expect(view.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Sites', value: 'No sites' }),
      expect.objectContaining({ label: 'Rules', value: 'No rules' }),
    ]))
  })
})

describe('keepAliveRulesPhrase', () => {
  it('reads zero keep-alive rules in lower case so it can follow a label', () => {
    expect(keepAliveRulesPhrase(0)).toBe('no rules')
    expect(keepAliveRulesPhrase(1)).toBe('1 rule')
  })
})

describe('homeViewFor status capitalisation', () => {
  it('capitalises the first word of the routing clause after the full stop', () => {
    const view = homeViewFor(input({ proxyList: [tokyo], defaultProxy: 'p1' }))

    expect(view.status?.sentence).toBe('Routing is on. Default proxy Tokyo SOCKS.')
  })
})
