import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }
const setAsideHost = { id: 'bad', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false, username: 'bad-user', password: 'bad-pass' }
const setAsideRule = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good' }
const setAsideProxyRule = { active: true, name: 'via set aside', match: ['https://setaside.example/*'], proxyId: 'bad' }
const extraRule = { active: true, name: 'extra', match: ['https://example.org/*'], proxyId: 'good' }

const setAsideStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [good, setAsideHost],
  [STORAGE_KEYS.rules]: [setAsideRule, setAsideProxyRule, goodRule],
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const wrongTypeProxy = { id: 'wrong', type: 'ftp', host: 'wrong.lan', port: 3128, proxyDNS: false, username: 'wrong-user', password: 'wrong-pass' }
const wrongTypeRule = { active: true, name: 'via wrong type', match: ['https://wrong.example/*'], proxyId: 'wrong' }

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

const addAuth = jest.fn()

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function lastPac () {
  const calls = (browser.proxy.settings.set as jest.Mock).mock.calls as any[][]
  return calls[calls.length - 1][0].value.pacScript.data as string
}

function lastPacWithoutEscapes () {
  return lastPac().replace(/\\/g, '')
}

function lastAuthListener () {
  const calls = addAuth.mock.calls as any[][]
  return calls[calls.length - 1][0] as (details: unknown) => unknown
}

function authFor (host: string, port: number) {
  return lastAuthListener()({ isProxy: true, challenger: { host, port } })
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

  it('keeps a set aside proxy out of the PAC and the auth filter, before and after a live change', async () => {
    ;(global as any).chrome = { webRequest: { onAuthRequired: { addListener: addAuth } } }
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in setAsideStored).map(k => [k, setAsideStored[k]]))
    })

    await import('../src/background.chrome')
    await flush()
    expect(browser.proxy.settings.set).toHaveBeenCalled()
    expect(lastPacWithoutEscapes()).toContain('setaside.example')
    expect(lastPacWithoutEscapes()).not.toContain('a:1; PROXY x:8080')
    expect(lastPacWithoutEscapes()).not.toContain('not a pattern')
    expect(authFor('a:1; PROXY x:8080', 80)).toEqual({})

    setAsideStored[STORAGE_KEYS.rules] = [setAsideRule, setAsideProxyRule, goodRule, extraRule]
    const changes = {
      [STORAGE_KEYS.rules]: { newValue: [setAsideRule, setAsideProxyRule, goodRule, extraRule] },
    }
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()

    expect(lastPacWithoutEscapes()).toContain('example.org')
    expect(lastPacWithoutEscapes()).toContain('setaside.example')
    expect(lastPacWithoutEscapes()).not.toContain('a:1; PROXY x:8080')
    expect(lastPacWithoutEscapes()).not.toContain('not a pattern')
    expect(authFor('a:1; PROXY x:8080', 80)).toEqual({})
  })
})

describe('Chrome background with wrong-type entries inside sections', () => {
  beforeAll(resetBackground)

  it('keeps a proxy of an unknown type out of the PAC and the auth filter, before and after a live change', async () => {
    ;(global as any).chrome = { webRequest: { onAuthRequired: { addListener: addAuth } } }
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in wrongTypeStored).map(k => [k, wrongTypeStored[k]]))
    })

    await import('../src/background.chrome')
    await flush()
    expect(browser.proxy.settings.set).toHaveBeenCalled()
    expect(lastPacWithoutEscapes()).toContain('good.lan')
    expect(lastPacWithoutEscapes()).toContain('wrong.example')
    expect(lastPacWithoutEscapes()).not.toContain('wrong.lan')
    expect(authFor('wrong.lan', 3128)).toEqual({})

    const changes = Object.fromEntries(Object.entries(wrongTypeStored).map(([k, v]) => [k, { newValue: v }]))
    for (const fn of [...browser.storage.onChanged._listeners]) await fn(changes, 'local')
    await flush()
    expect(lastPacWithoutEscapes()).toContain('good.lan')
    expect(lastPacWithoutEscapes()).toContain('example.com')
    expect(lastPacWithoutEscapes()).not.toContain('wrong.lan')
    expect(authFor('wrong.lan', 3128)).toEqual({})
  })
})
