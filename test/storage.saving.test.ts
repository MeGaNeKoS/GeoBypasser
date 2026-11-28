import { getConfig, updateConfig } from '@utils/storage'
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

describe('a stored rule field named like a compiled field', () => {
  it('survives a save of that rule', async () => {
    loadStored({ [STORAGE_KEYS.rules]: [{ name: 'ok', match: ['https://example.com/*'], proxyId: 'p1', compiledNote: 'kept' }] })
    const config = await getConfig()
    config.rules[0].active = false
    await updateConfig({ rules: config.rules })
    expect(writtenValue(STORAGE_KEYS.rules)[0]).toHaveProperty('compiledNote', 'kept')
  })
})

describe('stored proxy scope fields on a rule that is not edited', () => {
  it('are written back exactly as stored when another rule is saved', async () => {
    const scoped = {
      active: true, name: 'scoped', match: ['https://example.com/*'], proxyId: 'p1',
      proxyOnlyResourceTypes: ['image'], proxyOnlyPageHostnames: ['site.example'],
    }
    const other = { active: true, name: 'other', match: ['https://other.example/*'], proxyId: 'p1' }
    loadStored({ [STORAGE_KEYS.rules]: [scoped, other] })
    const config = await getConfig()
    config.rules[1].active = false
    await updateConfig({ rules: config.rules })
    expect(writtenValue(STORAGE_KEYS.rules)[0]).toEqual(scoped)
  })
})
