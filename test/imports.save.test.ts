import { getConfig, saveConfig } from '@utils/storage'
import { refuseRules, withImportedRules } from '@utils/importFiles'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { browser } from './setup'

function loadStored (data: Record<string, unknown>) {
  browser.storage.local.get.mockImplementation(async (keys: any) => {
    if (typeof keys === 'string') return {}
    return Object.fromEntries((keys as string[]).filter(k => k in data).map(k => [k, data[k]]))
  })
}

function lastWrittenRules () {
  const calls = browser.storage.local.set.mock.calls as any[][]
  return calls[calls.length - 1][0][STORAGE_KEYS.rules]
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('an import save', () => {
  it('leaves every stored rule it did not change exactly as it was, in order', async () => {
    const setAside = { active: false, name: 'Off', match: ['not a pattern'], proxyId: 'p1', futureField: 'kept' }
    const valid = { active: true, name: 'Valid', match: ['https://example.com/*'], proxyId: 'p1', futureField: { level: 2 } }
    loadStored({ [STORAGE_KEYS.rules]: [setAside, valid] })
    const imported = { active: true, name: 'New', match: ['https://example.net/*'], proxyId: 'p1' }

    const config = await getConfig()
    await saveConfig(withImportedRules(config, refuseRules([imported]).accepted))

    expect(lastWrittenRules()).toEqual([setAside, valid, imported])
  })
})
