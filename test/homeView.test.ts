import { homeViewFor } from '@utils/homeView'
import type { HomeInput } from '@utils/homeView'

const tokyo = { id: 'p1', type: 'http', host: 'tokyo.example', port: 8080, proxyDNS: false, label: 'Tokyo SOCKS' }

function rule (overrides: Record<string, unknown> = {}) {
  return { name: 'news', match: ['https://news.example/*'], proxyId: 'p1', active: true, ...overrides }
}

function input (overrides: Partial<HomeInput> & { settings?: Partial<HomeInput['settings']> } = {}): HomeInput {
  const { settings, ...rest } = overrides
  return {
    settings: {
      proxyList: [],
      rules: [],
      perWebsiteOverride: {},
      keepAliveRules: {},
      ...settings,
    },
    tabProxyMap: {},
    browser: 'firefox',
    ...rest,
  }
}

describe('homeViewFor first time', () => {
  it('chooses the first time case with no status and nothing ticked when nothing is stored', () => {
    const view = homeViewFor(input())

    expect(view.case).toBe('firstTime')
    expect(view.status).toBeNull()
    expect(view.getStarted).toEqual({ proxyAdded: false, choiceMade: false })
  })
})

describe('homeViewFor part way', () => {
  it('says nothing uses a proxy that is listed alone', () => {
    const view = homeViewFor(input({ settings: { proxyList: [tokyo] } }))

    expect(view.case).toBe('partWay')
    expect(view.status).toEqual({ tone: 'info', sentence: 'You have 1 proxy, but nothing uses them yet.' })
    expect(view.getStarted).toEqual({ proxyAdded: true, choiceMade: false })
  })

  it('says nothing is routed when rules exist and no proxy is usable', () => {
    const view = homeViewFor(input({ settings: { rules: [rule({ proxyId: 'gone' })] } }))

    expect(view.case).toBe('partWay')
    expect(view.status?.sentence).toBe('Nothing is routed yet. Add a proxy for your rules to use.')
  })
})

describe('homeViewFor set up', () => {
  it('lists the active rules and the default proxy in the status sentence', () => {
    const view = homeViewFor(input({
      settings: { proxyList: [tokyo], rules: [rule()], defaultProxy: 'p1' },
    }))

    expect(view.case).toBe('setUp')
    expect(view.status).toEqual({ tone: 'ok', sentence: 'Routing is on. 1 active rule, default proxy Tokyo SOCKS.' })
    expect(view.getStarted).toEqual({ proxyAdded: true, choiceMade: true })
  })

  it('ends with the direct sentence when no default proxy is set', () => {
    const view = homeViewFor(input({
      settings: { proxyList: [tokyo], perWebsiteOverride: { 'news.example': 'p1' } },
    }))

    expect(view.case).toBe('setUp')
    expect(view.status?.sentence).toBe('Routing is on. 1 site. Everything else connects directly.')
  })

  it('counts active and off rules on the rules row', () => {
    const view = homeViewFor(input({
      settings: {
        proxyList: [tokyo],
        rules: [rule(), rule({ name: 'shop', active: false }), rule({ name: 'docs' })],
      },
    }))

    expect(view.routes.find(row => row.label === 'Rules')).toEqual(
      expect.objectContaining({ section: 'rules', value: '2 active, 1 off' }),
    )
  })
})

describe('homeViewFor routes on each browser', () => {
  it('shows the tab proxy count on Firefox and a badge without a value on Chrome', () => {
    const tabs = { 1: 'p1', 2: 'p1', 3: 'gone' }
    const firefox = homeViewFor(input({ settings: { proxyList: [tokyo] }, tabProxyMap: tabs }))
    const chrome = homeViewFor(input({ settings: { proxyList: [tokyo] }, tabProxyMap: tabs, browser: 'chrome' }))

    expect(firefox.routes[0]).toEqual(expect.objectContaining({
      label: 'Tab proxy', value: '2 tabs have a proxy', note: 'Set from the popup.',
    }))
    expect(chrome.routes[0]).toEqual(expect.objectContaining({ label: 'Tab proxy', badge: 'firefox' }))
    expect(chrome.routes[0].value).toBeUndefined()
    expect(chrome.routes[0].section).toBeUndefined()
  })

  it('links the sites row on both browsers, with the limited badge on Chrome', () => {
    const settings = { proxyList: [tokyo], perWebsiteOverride: { 'news.example': 'p1' } }
    const firefox = homeViewFor(input({ settings }))
    const chrome = homeViewFor(input({ settings, browser: 'chrome' }))

    expect(firefox.routes[1]).toEqual(expect.objectContaining({ label: 'Sites', section: 'sites', value: '1 site' }))
    expect(chrome.routes[1]).toEqual(expect.objectContaining({ label: 'Sites', section: 'sites', badge: 'limited', value: '1 site' }))
  })

  it('marks keep-alive as Firefox only on Chrome', () => {
    const settings = { proxyList: [tokyo], keepAliveRules: { p1: { active: true, tabUrls: ['news.example'] } } }

    expect(homeViewFor(input({ settings })).proxies.keepAliveBadge).toBeUndefined()
    expect(homeViewFor(input({ settings, browser: 'chrome' })).proxies.keepAliveBadge).toBe('firefox')
  })
})

describe('homeViewFor Chrome control', () => {
  const setUpSettings = { proxyList: [tokyo], rules: [rule()] }

  it('says settings are not in effect when another extension controls the proxy on Chrome', () => {
    const view = homeViewFor(input({ settings: setUpSettings, browser: 'chrome', control: 'overridden' }))

    expect(view.status).toEqual({ tone: 'info', sentence: 'Your settings are saved but not in effect.' })
  })

  it('ignores the control state on Firefox', () => {
    const view = homeViewFor(input({ settings: setUpSettings, control: 'overridden' }))

    expect(view.status?.sentence).toBe('Routing is on. 1 active rule. Everything else connects directly.')
  })

  it('says settings are not in effect when Chrome cannot control the proxy', () => {
    const view = homeViewFor(input({ settings: setUpSettings, browser: 'chrome', control: 'unavailable' }))

    expect(view.status?.sentence).toBe('Your settings are saved but not in effect.')
  })
})

describe('homeViewFor failure note', () => {
  it('says requests fail when direct fallback is turned off', () => {
    expect(homeViewFor(input({ settings: { fallbackDirect: false } })).failureNote)
      .toBe('If a proxy fails: the request fails')
  })

  it('says requests connect directly by default', () => {
    expect(homeViewFor(input()).failureNote).toBe('If a proxy fails: connect directly')
  })
})
