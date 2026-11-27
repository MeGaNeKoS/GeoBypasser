import { getConfig } from '@utils/storage'
import { browser } from './setup'

beforeEach(() => {
  jest.clearAllMocks()
  browser.storage.local.get.mockResolvedValue({ storageMode: 'cloud' })
})

describe('getConfig with a stale cloud storage flag', () => {
  it('neither reads nor writes sync storage', async () => {
    await getConfig()
    expect(browser.storage.sync.get).not.toHaveBeenCalled()
    expect(browser.storage.sync.set).not.toHaveBeenCalled()
  })

  it('writes nothing, so the flag and config keys stay as stored', async () => {
    await getConfig()
    expect(browser.storage.local.set).not.toHaveBeenCalled()
    expect(browser.storage.local.remove).not.toHaveBeenCalled()
  })
})
