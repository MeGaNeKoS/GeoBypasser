import { getConfig } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { browser } from './setup'

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

describe('getConfig test URL', () => {
  it('uses a stored test URL that is valid', async () => {
    storeFixture({ [STORAGE_KEYS.testProxyUrl]: 'https://example.org/' })
    const config = await getConfig()
    expect(config.testProxyUrl).toBe('https://example.org/')
  })
})
