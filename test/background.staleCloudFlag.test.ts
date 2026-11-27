import { browser } from './setup'
import { startBackground, storeLocally } from './backgroundHarness'
import { STORAGE_KEYS } from '@constant/storageKeys'

const LOCAL_PROXY = { id: 'p1', type: 'http', host: 'local-proxy.lan', port: 8080, proxyDNS: false }

beforeEach(() => {
  jest.clearAllMocks()
  storeLocally({
    storageMode: 'cloud',
    [STORAGE_KEYS.proxyList]: [LOCAL_PROXY],
    [STORAGE_KEYS.defaultProxy]: 'p1',
  })
})

describe('Chrome background with a stale cloud storage flag', () => {
  it('applies a PAC script that routes through the local default proxy', async () => {
    await startBackground('chrome')
    const [{ value }] = browser.proxy.settings.set.mock.calls[0]
    expect(value.pacScript.data).toContain('PROXY local-proxy.lan:8080')
  })
})

describe('Firefox background with a stale cloud storage flag', () => {
  it('routes requests through the local default proxy', async () => {
    await startBackground('firefox')
    const listeners = browser.proxy.onRequest._listeners
    const defaultHandler = listeners[listeners.length - 1]
    const proxies = await defaultHandler({ url: 'https://example.com/', tabId: 1 })
    expect(proxies[0]).toMatchObject({ host: 'local-proxy.lan', port: 8080 })
  })
})
