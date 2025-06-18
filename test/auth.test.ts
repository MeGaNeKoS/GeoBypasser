import { browser } from './setup'
import { DEFAULT_SETTINGS } from '@constant/defaults'
import { compileRules } from '@utils/storage'

jest.mock('@utils/storage', () => {
  const original = jest.requireActual('@utils/storage')
  return {
    ...original,
    getConfig: jest.fn(async () => ({
      ...DEFAULT_SETTINGS,
      proxyList: [
        { id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true, username: 'u', password: 'p' },
      ],
      rules: compileRules([{ active: true, name: 'r', match: ['<all_urls>'], proxyId: 'p1' }]),
    })),
    getTabProxyMap: jest.fn(async () => ({})),
  }
})

describe('auth credentials', () => {
  it('supplies credentials on auth required', async () => {
    await import('../src/background.firefox')
    await Promise.resolve()
    const handler = browser.webRequest.onAuthRequired._listeners[0]
    const res = await handler({ challenger: { host: 'h', port: 80 } } as any)
    expect(res).toEqual({ authCredentials: { username: 'u', password: 'p' } })
  })
})
