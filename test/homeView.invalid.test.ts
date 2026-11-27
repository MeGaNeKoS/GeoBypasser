import { homeViewFor } from '@utils/homeView'
import type { HomeInput, HomeSettings } from '@utils/homeView'

const tokyo = { id: 'p1', type: 'http', host: 'tokyo.example', port: 8080, proxyDNS: false, label: 'Tokyo SOCKS' }
const brokenProxy = { id: 'p2', type: 'http', host: '', port: 0, proxyDNS: false }
const activeRule = { name: 'news', match: ['https://news.example/*'], proxyId: 'p1', active: true }
const brokenRule = { name: 'broken', match: [], proxyId: 'p1', active: true }

function settingsWithEverySetAsideKind (): HomeSettings {
  return {
    proxyList: [tokyo, brokenProxy],
    rules: [activeRule, brokenRule],
    perWebsiteOverride: { 'news.example': 'p1', 'bad host': 'p1' },
    keepAliveRules: {
      p1: { active: true, tabUrls: ['news.example'] },
      p2: { active: true, tabUrls: [] },
    },
    defaultProxy: 'p2',
  }
}

function inputFor (settings: HomeSettings, browser: HomeInput['browser']): HomeInput {
  return { settings, tabProxyMap: {}, browser }
}

describe('homeViewFor with set aside entries of every kind', () => {
  it('counts each set aside kind and lists a link for each on Firefox', () => {
    const view = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'firefox'))

    expect(view.setAside).toEqual({
      total: 4,
      sentence: '4 entries are not used because they are invalid:',
      links: [
        { label: '1 proxy', section: 'proxies' },
        { label: '1 rule', section: 'rules' },
        { label: '1 site', section: 'sites' },
        { label: '1 keep-alive rule', section: 'keep-alive' },
      ],
    })
  })

  it('shows the live counts and the needs fixing notes on the Firefox routes', () => {
    const view = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'firefox'))

    expect(view.routes[1]).toEqual({
      label: 'Sites', section: 'sites', value: '1 site', fixNote: '1 needs fixing', badge: undefined,
    })
    expect(view.routes[2]).toEqual(expect.objectContaining({
      label: 'Rules', section: 'rules', value: '1 active, 0 off', fixNote: '1 needs fixing',
    }))
    expect(view.proxies).toEqual(expect.objectContaining({ count: 1, fixNote: '1 needs fixing' }))
  })

  it('marks a default proxy that is set aside as unavailable and leaves the default out of the status', () => {
    const view = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'firefox'))

    expect(view.routes[3]).toEqual({ label: 'Default proxy', section: 'defaults', badge: 'unavailable' })
    expect(view.status).toEqual({ tone: 'ok', sentence: 'Routing is on. 1 active rule, 1 site. Everything else connects directly.' })
  })

  it('leaves the sites link out on Chrome, where the sites section is not shown', () => {
    const view = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'chrome'))

    expect(view.routes[1]).toEqual(expect.objectContaining({
      label: 'Sites', value: '1 site', fixNote: '1 needs fixing', badge: 'limited',
    }))
    expect(view.routes[1].section).toBeUndefined()
    expect(view.setAside.links.map(link => link.section)).toEqual(['proxies', 'rules', undefined, 'keep-alive'])
  })

  it('keeps every other count the same on Chrome', () => {
    const firefox = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'firefox'))
    const chrome = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'chrome'))

    expect(chrome.setAside.links.map(({ label }) => label)).toEqual(firefox.setAside.links.map(({ label }) => label))
    expect(chrome.setAside.total).toBe(firefox.setAside.total)
    expect(chrome.routes[2]).toEqual(firefox.routes[2])
    expect(chrome.proxies).toEqual({ ...firefox.proxies, keepAliveBadge: 'firefox' })
  })
})

describe('homeViewFor with only set aside entries', () => {
  it('is not the first time case when a proxy is stored but invalid', () => {
    const view = homeViewFor(inputFor({ proxyList: [brokenProxy], rules: [], perWebsiteOverride: {}, keepAliveRules: {} }, 'firefox'))

    expect(view.case).toBe('partWay')
    expect(view.status?.sentence).toBe('Nothing is routed yet. Add a proxy for your rules to use.')
    expect(view.setAside).toEqual({
      total: 1,
      sentence: '1 entry is not used because it is invalid:',
      links: [{ label: '1 proxy', section: 'proxies' }],
    })
  })

  it('is not the first time case when only a default proxy id is stored', () => {
    const view = homeViewFor(inputFor({ proxyList: [], rules: [], perWebsiteOverride: {}, keepAliveRules: {}, defaultProxy: 'p1' }, 'firefox'))

    expect(view.case).toBe('partWay')
    expect(view.routes[3]).toEqual({ label: 'Default proxy', section: 'defaults', badge: 'unavailable' })
  })
})

describe('homeViewFor set aside links on Chrome', () => {
  it('shows the set aside site count without a link, since the Sites section is not shown on Chrome', () => {
    const view = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'chrome'))

    expect(view.setAside.links).toContainEqual({ label: '1 site' })
    expect(view.setAside.links).toContainEqual({ label: '1 proxy', section: 'proxies' })
  })

  it('keeps the set aside site link on Firefox', () => {
    const view = homeViewFor(inputFor(settingsWithEverySetAsideKind(), 'firefox'))

    expect(view.setAside.links).toContainEqual({ label: '1 site', section: 'sites' })
  })
})

describe('homeViewFor needs fixing note', () => {
  it('uses the plural form when more than one rule is set aside', () => {
    const settings = { ...settingsWithEverySetAsideKind(), rules: [activeRule, brokenRule, { ...brokenRule, name: 'second' }] }
    const view = homeViewFor(inputFor(settings, 'firefox'))

    expect(view.routes[2]).toEqual(expect.objectContaining({ fixNote: '2 need fixing' }))
  })
})
