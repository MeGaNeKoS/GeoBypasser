import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'

jest.mock('@utils/tab', () => {
  const original = jest.requireActual('@utils/tab')
  return { ...original, maybeUpdateProxyKeepAlive: jest.fn() }
})

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }
const setAsideHost = { id: 'bad', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false }
const setAsideRule = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good' }
const setAsideProxyRule = { active: true, name: 'via set aside', match: ['https://setaside.example/*'], proxyId: 'bad' }
const wrongTypeProxy = { id: 'wrong', type: 'ftp', host: 'wrong.lan', port: 3128, proxyDNS: false }
const wrongTypeRule = { active: true, name: 'via wrong type', match: ['https://wrong.example/*'], proxyId: 'wrong' }

const setAsideStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [good, setAsideHost],
  [STORAGE_KEYS.rules]: [setAsideRule, setAsideProxyRule, goodRule],
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const wrongTypeStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [null, 'text', {}, { id: 'partial' }, good, wrongTypeProxy],
  [STORAGE_KEYS.rules]: [null, 'text', {}, { name: 'partial' }, goodRule, wrongTypeRule],
  [STORAGE_KEYS.keepAliveRules]: {
    a: null,
    b: 'text',
    c: {},
    d: { active: true },
    good: { active: true, tabUrls: ['example.com'] },
  },
  [STORAGE_KEYS.perWebsiteOverride]: { 'a.example': null, 'b.example': {}, 'c.example': 'good' },
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

async function routeFor (url: string) {
  const results = await Promise.all(
    [...browser.proxy.onRequest._listeners].map(fn => fn({ url, type: 'main_frame', tabId: -1 })),
  )
  return JSON.stringify(results)
}

function resetBackground () {
  for (const event of [browser.proxy.onRequest, browser.storage.onChanged, browser.tabs.onUpdated]) {
    event._listeners.length = 0
  }
  jest.clearAllMocks()
  jest.resetModules()
}

describe('Firefox background with set aside entries', () => {
  beforeAll(resetBackground)

  it('keeps a set aside proxy out of the request filter, before and after a live change', async () => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in setAsideStored).map(k => [k, setAsideStored[k]]))
    })
    const addSpy = jest.spyOn(browser.proxy.onRequest, 'addListener')

    await import('../src/background.firefox')
    await flush()

    const filters = addSpy.mock.calls.map(call => JSON.stringify(call[1] ?? {}))
    expect(filters.some(f => f.includes('not a pattern'))).toBe(false)
    expect(await routeFor('https://setaside.example/a')).not.toContain('a:1; PROXY x:8080')
    expect(await routeFor('https://example.com/a')).toContain('good.lan')

    const changes = {
      [STORAGE_KEYS.rules]: { newValue: [setAsideRule, setAsideProxyRule, goodRule] },
      [STORAGE_KEYS.proxyList]: { newValue: [good, setAsideHost] },
    }
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()

    expect(await routeFor('https://setaside.example/a')).not.toContain('a:1; PROXY x:8080')
    expect(await routeFor('https://example.com/a')).toContain('good.lan')
    expect(await routeFor('https://example.com/a')).not.toContain('a:1; PROXY x:8080')
  })
})

describe('Firefox background with wrong-type entries inside sections', () => {
  beforeAll(resetBackground)

  it('starts, keeps a proxy of an unknown type out of the request filter, and survives a live change carrying the same entries', async () => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in wrongTypeStored).map(k => [k, wrongTypeStored[k]]))
    })

    await import('../src/background.firefox')
    await flush()
    expect(browser.storage.onChanged._listeners).toHaveLength(1)
    expect(await routeFor('https://wrong.example/a')).not.toContain('wrong.lan')
    expect(await routeFor('https://example.com/a')).toContain('good.lan')

    const changes = Object.fromEntries(Object.entries(wrongTypeStored).map(([k, v]) => [k, { newValue: v }]))
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()
    expect(browser.storage.onChanged._listeners).toHaveLength(1)
    expect(await routeFor('https://wrong.example/a')).not.toContain('wrong.lan')
    expect(await routeFor('https://example.com/a')).toContain('good.lan')
  })

  it('handles a tab update against the keep-alive section without an exception', () => {
    const [onUpdated] = browser.tabs.onUpdated._listeners
    expect(onUpdated).toBeDefined()
    const tab = { id: 1, url: 'https://example.com/a', discarded: false }
    expect(() => onUpdated(1, { url: tab.url }, tab)).not.toThrow()
  })
})
