import { compileRules, getConfig, saveConfig, updateConfig } from '@utils/storage'
import { DEFAULT_SETTINGS } from '@constant/defaults'
import { STORAGE_KEYS } from '@constant/storageKeys'
import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import type { ProxyRule } from '@customTypes/proxy'
import { browser } from './setup'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('compileRules', () => {
  it('compiles regex and url patterns', () => {
    const rules: ProxyRule[] = [
      {
        active: true,
        name: 'r',
        match: ['https://example.com/*'],
        staticExtensions: '/\\.(?:jpg|png)$/i',
        proxyId: 'p1',
      },
    ]
    const compiled = compileRules(rules)
    expect(compiled[0].compiledMatch).toBeDefined()
    expect(compiled[0].compiledStaticExtensions).toBeInstanceOf(RegExp)
  })
})

describe('getConfig', () => {
  it('returns defaults when storage empty and compiles rules', async () => {
    browser.storage.local.get.mockResolvedValue({})
    const spyMode = jest.spyOn(require('@utils/storage'), 'getUserStorageMode').mockResolvedValue('local')
    browser.storage.local.set.mockResolvedValue(undefined)

    const config = await getConfig()
    expect(config).toEqual({ ...DEFAULT_SETTINGS, rules: [] })
    expect(browser.storage.local.set).toHaveBeenCalled()
    spyMode.mockRestore()
  })
})

describe('saveConfig and updateConfig', () => {
  const runtimeConfig: GeoBypassRuntimeSettings = {
    proxyList: [{ id: 'p1', type: 'http', host: 'h', port: 1, proxyDNS: true }],
    defaultProxy: 'p1',
    fallbackDirect: true,
    testProxyUrl: 'https://t/',
    rules: compileRules([{ active: true, name: 'r', match: ['<all_urls>'], proxyId: 'p1' }]),
    perWebsiteOverride: {},
  }

  it('stores only non-compiled fields', async () => {
    browser.storage.local.set.mockResolvedValue(undefined)
    const modeSpy = jest.spyOn(require('@utils/storage'), 'getUserStorageMode').mockResolvedValue('local')

    await saveConfig(runtimeConfig as unknown as GeoBypassSettings)
    expect(browser.storage.local.set).toHaveBeenCalled()
    const arg = browser.storage.local.set.mock.calls[0][0]
    expect(arg[STORAGE_KEYS.rules][0]).not.toHaveProperty('compiledMatch')
    modeSpy.mockRestore()
  })

  it('updateConfig saves partial fields', async () => {
    browser.storage.local.set.mockResolvedValue(undefined)
    const modeSpy = jest.spyOn(require('@utils/storage'), 'getUserStorageMode').mockResolvedValue('local')
    await updateConfig({ defaultProxy: 'p2', rules: [] })
    expect(browser.storage.local.set).toHaveBeenCalled()
    const arg = browser.storage.local.set.mock.calls[0][0]
    expect(arg).toEqual({ [STORAGE_KEYS.defaultProxy]: 'p2', [STORAGE_KEYS.rules]: [] })
    modeSpy.mockRestore()
  })
})
