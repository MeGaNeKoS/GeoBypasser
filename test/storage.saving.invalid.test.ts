import { getConfig, saveConfig, updateConfig } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { browser } from './setup'

const rawRules = [
  { name: 'bad', match: ['not a pattern'], proxyId: 'p1', futureField: { keep: true } },
  { name: 'ok', match: ['https://example.com/*'], proxyId: 'p1', active: false, extra: 'kept' },
  { name: 'third', match: ['https://example.org/*'], proxyId: 'p1', active: true },
]

const stored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [{ id: 'p1', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false }],
  [STORAGE_KEYS.rules]: rawRules,
  [STORAGE_KEYS.perWebsiteOverride]: { 'example.com': 'p1' },
}

function loadStored (data: Record<string, unknown>) {
  browser.storage.local.get.mockImplementation(async (keys: any) => {
    if (typeof keys === 'string') return {}
    return Object.fromEntries((keys as string[]).filter(k => k in data).map(k => [k, data[k]]))
  })
}

function writtenValue (key: string) {
  const calls = browser.storage.local.set.mock.calls as any[][]
  const last = calls[calls.length - 1][0]
  return last[key]
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('saveConfig after a user edit', () => {
  it('stores every entry the user did not edit exactly as it was and in order', async () => {
    loadStored(stored)
    const config = await getConfig()
    config.rules[2].name = 'renamed'
    await saveConfig(config)

    const saved = writtenValue(STORAGE_KEYS.rules)
    expect(saved).toHaveLength(3)
    expect(saved[0]).toEqual(rawRules[0])
    expect(saved[1]).toEqual(rawRules[1])
    expect(saved[1]).not.toHaveProperty('compiledMatch')
    expect(saved[2]).toEqual({ ...rawRules[2], name: 'renamed' })
  })

  it('does not rewrite an unchanged proxy list, so a set aside proxy stays as stored', async () => {
    loadStored(stored)
    const config = await getConfig()
    await saveConfig(config)
    expect(browser.storage.local.set).not.toHaveBeenCalled()
  })

  it('writes a changed proxy list with the set aside proxy still in it', async () => {
    loadStored(stored)
    const config = await getConfig()
    config.proxyList.push({ id: 'p2', type: 'http', host: 'two.lan', port: 3128, proxyDNS: false } as any)
    await saveConfig(config)
    const setAsideProxy = { id: 'p1', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false }
    const added = { id: 'p2', type: 'http', host: 'two.lan', port: 3128, proxyDNS: false }
    expect(writtenValue(STORAGE_KEYS.proxyList)).toEqual([setAsideProxy, added])
  })
})

describe('updateConfig from the popup', () => {
  it('stores untouched rules exactly as they were', async () => {
    loadStored(stored)
    const config = await getConfig()
    config.rules[1].active = true
    await updateConfig({ rules: config.rules })
    const saved = writtenValue(STORAGE_KEYS.rules)
    expect(saved[0]).toEqual(rawRules[0])
    expect(saved[1]).toEqual({ ...rawRules[1], active: true })
    expect(saved[2]).toEqual(rawRules[2])
  })
})

describe('a section of the wrong type that is not saved', () => {
  it('is not written when another section is saved', async () => {
    loadStored({ [STORAGE_KEYS.rules]: 'oops', [STORAGE_KEYS.proxyList]: [] })
    await updateConfig({ perWebsiteOverride: { 'example.com': 'p1' } })
    const written = (browser.storage.local.set.mock.calls as any[][]).flatMap(call => Object.keys(call[0]))
    expect(written).not.toContain(STORAGE_KEYS.rules)
  })

  it('is not written by a full save that did not change it', async () => {
    loadStored({ [STORAGE_KEYS.rules]: 'oops' })
    const config = await getConfig()
    await saveConfig(config)
    const written = (browser.storage.local.set.mock.calls as any[][]).flatMap(call => Object.keys(call[0]))
    expect(written).not.toContain(STORAGE_KEYS.rules)
  })
})
