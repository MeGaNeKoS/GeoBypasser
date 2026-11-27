import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }
const setAsideHost = { id: 'bad', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false }
const setAsideRule = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good' }
const extraRule = { active: true, name: 'extra', match: ['https://example.org/*'], proxyId: 'good' }

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

function lastPac () {
  const calls = (browser.proxy.settings.set as jest.Mock).mock.calls as any[][]
  return calls[calls.length - 1][0].value.pacScript.data as string
}

function resetBackground () {
  for (const event of [browser.proxy.onRequest, browser.storage.onChanged, browser.webRequest.onAuthRequired]) {
    event._listeners.length = 0
  }
  jest.clearAllMocks()
  jest.resetModules()
}

describe('Chrome background with set aside entries', () => {
  beforeAll(resetBackground)

  it('loads, applies a PAC without set aside entries, and survives a live change', async () => {
    const addAuth = jest.fn()
    ;(global as any).chrome = { webRequest: { onAuthRequired: { addListener: addAuth } } }
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in setAsideStored).map(k => [k, setAsideStored[k]]))
    })

    await import('../src/background.chrome')
    await flush()
    expect(browser.proxy.settings.set).toHaveBeenCalled()
    expect(lastPac()).toContain('good.lan')
    expect(lastPac()).not.toContain('not a pattern')
    expect(lastPac()).not.toContain('a:1; PROXY x:8080')

    setAsideStored[STORAGE_KEYS.rules] = [setAsideRule, goodRule, extraRule]
    const changes = {
      [STORAGE_KEYS.rules]: { newValue: [setAsideRule, goodRule, extraRule] },
    }
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()

    expect(lastPac()).toContain('example.org')
    expect(lastPac()).toContain('good.lan')
    expect(lastPac()).not.toContain('not a pattern')
    expect(lastPac()).not.toContain('a:1; PROXY x:8080')
  })
})

describe('Chrome background with wrong-type entries inside sections', () => {
  beforeAll(resetBackground)

  it('applies a PAC and survives a live change carrying the same entries', async () => {
    ;(global as any).chrome = { webRequest: { onAuthRequired: { addListener: jest.fn() } } }
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in wrongTypeStored).map(k => [k, wrongTypeStored[k]]))
    })

    await import('../src/background.chrome')
    await flush()
    expect(browser.proxy.settings.set).toHaveBeenCalled()
    expect(lastPac()).toContain('good.lan')

    const changes = Object.fromEntries(Object.entries(wrongTypeStored).map(([k, v]) => [k, { newValue: v }]))
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()
    expect(lastPac()).toContain('good.lan')
    expect(lastPac()).toContain('example.com')
  })
})
