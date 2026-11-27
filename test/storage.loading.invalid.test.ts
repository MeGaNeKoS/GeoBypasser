import { getConfig } from '@utils/storage'
import { usableOverrides } from '@utils/usable'
import { makeProxyHandler } from '@utils/proxy'
import { isRuleShownInvalid } from '@utils/validity'
import { DEFAULT_SETTINGS } from '@constant/defaults'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { browser } from './setup'

const legacy: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [{ id: 'p1', type: 'http', host: 'proxy_1.lan', port: 8080, proxyDNS: false }],
  [STORAGE_KEYS.defaultProxy]: 'p1',
  [STORAGE_KEYS.fallbackDirect]: true,
  [STORAGE_KEYS.testProxyUrl]: 'www.google.com',
  [STORAGE_KEYS.rules]: [
    { active: true, name: 'static', match: ['https://example.com/*'], staticExtensions: '\\.(png|css)$', proxyId: 'p1' },
    { active: true, name: 'bad', match: ['https://example.com:8080/*'], proxyId: 'p1' },
  ],
  [STORAGE_KEYS.perWebsiteOverride]: {},
}

function storeFixture (data: Record<string, unknown>) {
  browser.storage.local.get.mockImplementation(async (keys: any) => {
    if (typeof keys === 'string') return {}
    return Object.fromEntries(
      (keys as string[]).filter(k => k in data).map(k => [k, data[k]]),
    )
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getConfig with set aside entries', () => {
  it('loads without throwing and keeps the set aside entries in memory', async () => {
    storeFixture({
      [STORAGE_KEYS.proxyList]: [{ id: 'p1', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false }],
      [STORAGE_KEYS.rules]: [
        { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'p1' },
        { active: true, name: 'ok', match: ['https://example.com/*'], proxyId: 'p1' },
      ],
    })
    const config = await getConfig()
    expect(config.rules.map(r => r.name)).toEqual(['bad', 'ok'])
    expect(config.proxyList.map(p => p.id)).toEqual(['p1'])
  })
})

describe('getConfig writes', () => {
  it('writes nothing to config keys when storage is empty', async () => {
    storeFixture({})
    const config = await getConfig()
    expect(browser.storage.local.set).not.toHaveBeenCalled()
    expect(config.proxyList).toEqual(DEFAULT_SETTINGS.proxyList)
  })

  it('writes nothing to config keys when stored config is set aside', async () => {
    storeFixture({ [STORAGE_KEYS.rules]: [{ name: 'x' }] })
    await getConfig()
    expect(browser.storage.local.set).not.toHaveBeenCalled()
  })
})

describe('getConfig test URL', () => {
  it('uses the default test URL when the stored one is not valid', async () => {
    storeFixture({ [STORAGE_KEYS.testProxyUrl]: 'www.google.com' })
    const config = await getConfig()
    expect(config.testProxyUrl).toBe(DEFAULT_SETTINGS.testProxyUrl)
    expect(browser.storage.local.set).not.toHaveBeenCalled()
  })
})

describe('config written before the validity story', () => {
  beforeEach(() => {
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in legacy).map(k => [k, legacy[k]]))
    })
  })

  it('keeps every entry in storage and writes nothing', async () => {
    await getConfig()
    expect(browser.storage.local.set).not.toHaveBeenCalled()
    expect(browser.storage.local.remove).not.toHaveBeenCalled()
  })

  it('still routes the rule whose staticExtensions is not in slash form', async () => {
    const config = await getConfig()
    const res = await makeProxyHandler(config)({ url: 'https://example.com/a.png', type: 'image' } as any)
    expect(res).toEqual(expect.arrayContaining([expect.objectContaining({ host: 'proxy_1.lan' })]))
  })

  it('shows the rule with a port in its match pattern as invalid', async () => {
    const config = await getConfig()
    expect(isRuleShownInvalid(config.rules[1])).toBe(true)
    expect(isRuleShownInvalid(config.rules[0])).toBe(true)
  })

  it('uses the proxy host as stored', async () => {
    const config = await getConfig()
    expect(config.proxyList[0].host).toBe('proxy_1.lan')
  })

  it('does not use the stored test URL', async () => {
    const config = await getConfig()
    expect(config.testProxyUrl).not.toBe('www.google.com')
  })
})

describe('website overrides with an invalid key', () => {
  it('warns once for the invalid key at config load and not again when overrides are read', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    storeFixture({ [STORAGE_KEYS.perWebsiteOverride]: { 'bad domain': 'p1', 'good.example': 'p1' } })
    const config = await getConfig()
    usableOverrides(config.perWebsiteOverride)
    usableOverrides(config.perWebsiteOverride)
    const overrideWarnings = warn.mock.calls.filter(([message]) => String(message).includes('Website override'))
    expect(overrideWarnings).toHaveLength(1)
    warn.mockRestore()
  })
})
