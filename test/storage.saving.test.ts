import { getConfig, saveConfig } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { browser } from './setup'

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

describe('a section of the wrong type', () => {
  it('is replaced when the user saves that section', async () => {
    loadStored({ [STORAGE_KEYS.rules]: 'oops' })
    const config = await getConfig()
    config.rules.push({ name: 'new', match: ['https://example.net/*'], proxyId: 'p1' } as any)
    await saveConfig(config)
    const last = (browser.storage.local.set.mock.calls as any[][]).slice(-1)[0][0]
    expect(last[STORAGE_KEYS.rules]).toEqual([{ name: 'new', match: ['https://example.net/*'], proxyId: 'p1' }])
  })
})
