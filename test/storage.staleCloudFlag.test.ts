import { getConfig } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { browser } from './setup'

const LOCAL_PROXY = { id: 'p1', type: 'http', host: 'local-proxy.lan', port: 8080, proxyDNS: false }

beforeEach(() => {
  jest.clearAllMocks()
  browser.storage.local.get.mockResolvedValue({
    storageMode: 'cloud',
    [STORAGE_KEYS.proxyList]: [LOCAL_PROXY],
    [STORAGE_KEYS.defaultProxy]: 'p1',
    [STORAGE_KEYS.fallbackDirect]: false,
    [STORAGE_KEYS.testProxyUrl]: 'https://local.example/',
  })
})

describe('getConfig with a stale cloud storage flag', () => {
  it('loads the config from local storage', async () => {
    const config = await getConfig()
    expect(config.proxyList).toEqual([LOCAL_PROXY])
    expect(config.defaultProxy).toBe('p1')
    expect(config.fallbackDirect).toBe(false)
    expect(config.testProxyUrl).toBe('https://local.example/')
  })
})
