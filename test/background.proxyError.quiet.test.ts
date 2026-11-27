import { browser } from './setup'
import { startBackground } from './backgroundHarness'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('browser proxy error', () => {
  it('raises no notification', async () => {
    await startBackground('firefox')
    const silenced = jest.spyOn(console, 'error').mockImplementation(() => {})
    const listener = browser.proxy.onError._listeners[0]

    listener({ message: 'NS_ERROR_PROXY_CONNECTION_REFUSED' })

    expect(browser.notifications.create).not.toHaveBeenCalled()
    silenced.mockRestore()
  })
})
