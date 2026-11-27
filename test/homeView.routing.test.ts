import { homeViewFor } from '@utils/homeView'
import type { HomeInput } from '@utils/homeView'

const tokyo = { id: 'p1', type: 'http', host: 'tokyo.example', port: 8080, proxyDNS: false, label: 'Tokyo SOCKS' }

function rule (overrides: Record<string, unknown> = {}) {
  return { name: 'news', match: ['https://news.example/*'], proxyId: 'p1', active: true, ...overrides }
}

function input (settings: Partial<HomeInput['settings']>): HomeInput {
  return {
    settings: { proxyList: [], rules: [], perWebsiteOverride: {}, keepAliveRules: {}, ...settings },
    tabProxyMap: {},
    browser: 'firefox',
  }
}

describe('homeViewFor routing claims', () => {
  it('does not claim routing when the only rule points at a proxy that is not listed and there is no default', () => {
    const view = homeViewFor(input({ proxyList: [tokyo], rules: [rule({ proxyId: 'gone' })] }))

    expect(view.case).toBe('partWay')
    expect(view.status?.sentence).toBe('You have 1 proxy, but nothing uses them yet.')
  })

  it('counts a rule whose proxy is not listed as routing when a usable default proxy can take it', () => {
    const view = homeViewFor(input({ proxyList: [tokyo], rules: [rule({ proxyId: 'gone' })], defaultProxy: 'p1' }))

    expect(view.case).toBe('setUp')
    expect(view.status?.sentence).toBe('Routing is on. 1 active rule, default proxy Tokyo SOCKS.')
  })

  it('does not count an inactive rule as routing', () => {
    const view = homeViewFor(input({ proxyList: [tokyo], rules: [rule({ active: false })] }))

    expect(view.case).toBe('partWay')
    expect(view.status?.sentence).toBe('You have 1 proxy, but nothing uses them yet.')
  })
})
