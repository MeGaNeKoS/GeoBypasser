import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'

jest.mock('@utils/tab', () => {
  const original = jest.requireActual('@utils/tab')
  return { ...original, maybeUpdateProxyKeepAlive: jest.fn() }
})

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false }
const bad = { id: 'bad', type: 'http', host: 'bad.lan', port: 8081, proxyDNS: false }

const setAsideStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [good, bad],
  [STORAGE_KEYS.keepAliveRules]: {
    good: { active: true, tabUrls: ['example.com'] },
    bad: { active: true, tabUrls: ['not a pattern'] },
  },
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const invalidUrlStored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [good],
  [STORAGE_KEYS.keepAliveRules]: {
    good: { active: true, tabUrls: ['example.com'], testProxyUrl: 'not a url' },
  },
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function resetBackground () {
  for (const event of [browser.storage.onChanged, browser.tabs.onUpdated, browser.tabs.onActivated]) {
    event._listeners.length = 0
  }
  jest.clearAllMocks()
  jest.resetModules()
}

describe('keep-alive entries that are set aside', () => {
  beforeAll(resetBackground)

  it('starts keep-alive only for the usable entry, as if the set aside one were deleted', async () => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in setAsideStored).map(k => [k, setAsideStored[k]]))
    })
    ;(browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 1, url: 'https://example.com/a', discarded: false }])
    const maybeUpdate = require('@utils/tab').maybeUpdateProxyKeepAlive as jest.Mock
    maybeUpdate.mockClear()

    await import('../src/background.firefox')
    await flush()

    const proxyIds = maybeUpdate.mock.calls.map(call => call[0].id)
    expect(proxyIds).toContain('good')
    expect(proxyIds).not.toContain('bad')
  })
})

describe('keep-alive rule with an invalid test URL', () => {
  beforeAll(resetBackground)

  it('keeps the rule and uses the default test URL in its place', async () => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in invalidUrlStored).map(k => [k, invalidUrlStored[k]]))
    })
    ;(browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 1, url: 'https://example.com/a', discarded: false }])
    const maybeUpdate = require('@utils/tab').maybeUpdateProxyKeepAlive as jest.Mock
    maybeUpdate.mockClear()

    await import('../src/background.firefox')
    await flush()

    expect(maybeUpdate).toHaveBeenCalled()
    const state = maybeUpdate.mock.calls[0][1]
    expect(state.testUrl).toBe('https://www.google.com/')
  })
})
