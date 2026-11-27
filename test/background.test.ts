import { browser } from './setup'
import { letBackgroundStart } from './keepAliveFakeCheck'

jest.mock('@utils/storage', () => {
  const original = jest.requireActual('@utils/storage')
  return {
    ...original,
    readStoredSections: jest.fn(async () => ({
      proxyList: [{ id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true }],
      defaultProxy: undefined,
      fallbackDirect: undefined,
      testProxyUrl: undefined,
      rules: [{ active: true, name: 'r', match: ['<all_urls>'], proxyId: 'p1' }],
      keepAliveRules: { p1: { active: true, tabUrls: ['example.com'] } },
      perWebsiteOverride: undefined,
    })),
    getTabProxyMap: jest.fn(async () => ({})),
  }
})

jest.mock('@adapters/firefox', () => require('./keepAliveFakeCheck').withFakeProxyCheck())

describe('background init', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('attaches handlers and keep-alive', async () => {
    (browser.tabs.query as jest.Mock).mockResolvedValue([{ id: 1, url: 'https://example.com/a', discarded: false }])
    await import('../src/background.firefox')
    await letBackgroundStart()
    expect(browser.proxy.onRequest._listeners.length).toBeGreaterThan(0)
    const { fakeProxyCheck } = require('@adapters/firefox') as { fakeProxyCheck: jest.Mock }
    expect(fakeProxyCheck).toHaveBeenCalled()
  })
})
