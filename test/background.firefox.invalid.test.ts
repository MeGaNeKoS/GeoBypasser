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

const setAsideStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [good, setAsideHost],
  [STORAGE_KEYS.rules]: [setAsideRule, goodRule],
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const wrongTypeStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [null, 'text', {}, { id: 'partial' }, good],
  [STORAGE_KEYS.rules]: [null, 'text', {}, { name: 'partial' }, goodRule],
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

function resetBackground () {
  for (const event of [browser.proxy.onRequest, browser.storage.onChanged, browser.tabs.onUpdated]) {
    event._listeners.length = 0
  }
  jest.clearAllMocks()
  jest.resetModules()
}

describe('Firefox background with set aside entries', () => {
  beforeAll(resetBackground)

  it('loads, keeps routing, and survives a live change that carries set aside entries', async () => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in setAsideStored).map(k => [k, setAsideStored[k]]))
    })
    const addSpy = jest.spyOn(browser.proxy.onRequest, 'addListener')

    await import('../src/background.firefox')
    await flush()

    const filters = addSpy.mock.calls.map(call => JSON.stringify(call[1] ?? {}))
    expect(filters.some(f => f.includes('not a pattern'))).toBe(false)

    const changes = {
      [STORAGE_KEYS.rules]: { newValue: [setAsideRule, goodRule] },
      [STORAGE_KEYS.proxyList]: { newValue: [good, setAsideHost] },
    }
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()

    const results = await Promise.all(
      [...browser.proxy.onRequest._listeners].map(fn =>
        fn({ url: 'https://example.com/a', type: 'main_frame', tabId: -1 }),
      ),
    )
    const text = JSON.stringify(results)
    expect(text).toContain('good.lan')
    expect(text).not.toContain('a:1; PROXY x:8080')
  })
})

describe('Firefox background with wrong-type entries inside sections', () => {
  beforeAll(resetBackground)

  it('starts, registers its storage listener, and survives a live change carrying the same entries', async () => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in wrongTypeStored).map(k => [k, wrongTypeStored[k]]))
    })

    await import('../src/background.firefox')
    await flush()
    expect(browser.storage.onChanged._listeners).toHaveLength(1)

    const changes = Object.fromEntries(Object.entries(wrongTypeStored).map(([k, v]) => [k, { newValue: v }]))
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()
    expect(browser.storage.onChanged._listeners).toHaveLength(1)
  })

  it('handles a tab update against the keep-alive section without an exception', () => {
    const [onUpdated] = browser.tabs.onUpdated._listeners
    expect(onUpdated).toBeDefined()
    const tab = { id: 1, url: 'https://example.com/a', discarded: false }
    expect(() => onUpdated(1, { url: tab.url }, tab)).not.toThrow()
  })
})
