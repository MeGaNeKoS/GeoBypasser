import { browser } from './setup'

jest.mock('@utils/storage', () => {
  const original = jest.requireActual('@utils/storage')
  return {
    ...original,
    readStoredSections: jest.fn(async () => ({
      proxyList: [
        { id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true, username: 'u', password: 'p' },
      ],
      defaultProxy: undefined,
      fallbackDirect: undefined,
      testProxyUrl: undefined,
      rules: [{ active: true, name: 'r', match: ['<all_urls>'], proxyId: 'p1' }],
      keepAliveRules: undefined,
      perWebsiteOverride: undefined,
    })),
    getTabProxyMap: jest.fn(async () => ({})),
  }
})

describe('auth credentials', () => {
  it('supplies credentials on auth required', async () => {
    await import('../src/background.firefox')
    await Promise.resolve()
    const handler = browser.webRequest.onAuthRequired._listeners[0]
    const res = await handler({ isProxy: true, challenger: { host: 'h', port: 80 } } as any)
    expect(res).toEqual({ authCredentials: { username: 'u', password: 'p' } })
  })
})
