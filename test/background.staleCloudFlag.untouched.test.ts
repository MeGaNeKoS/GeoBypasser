import { browser } from './setup'
import { startBackground, storeLocally } from './backgroundHarness'
import { TAB_PROXY_MAP } from '@constant/storageKeys'

beforeEach(() => {
  jest.clearAllMocks()
  storeLocally({ storageMode: 'cloud' })
})

describe.each(['firefox', 'chrome'] as const)('%s background with a stale cloud storage flag', name => {
  it('writes no config or flag to local or sync storage on startup', async () => {
    await startBackground(name)
    expect(browser.storage.local.set).not.toHaveBeenCalled()
    expect(browser.storage.sync.set).not.toHaveBeenCalled()
    expect(browser.storage.sync.remove).not.toHaveBeenCalled()
  })

  it('removes nothing from local storage except the tab proxy map', async () => {
    await startBackground(name)
    const removedKeys = browser.storage.local.remove.mock.calls.map(([key]: [string]) => key)
    expect(removedKeys.every((key: string) => key === TAB_PROXY_MAP)).toBe(true)
  })
})
