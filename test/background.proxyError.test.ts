import { browser } from './setup'
import { startBackground } from './backgroundHarness'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('browser proxy error', () => {
  it('logs the error message without the rest of the error object', async () => {
    await startBackground('firefox')
    const logged = [jest.spyOn(console, 'error').mockImplementation(() => {}), jest.spyOn(console, 'dir').mockImplementation(() => {})]
    const listener = browser.proxy.onError._listeners[0]

    listener({ message: 'NS_ERROR_PROXY_CONNECTION_REFUSED', detail: 'http://user:secret@proxy.example:8080' })

    expect(logged[0]).toHaveBeenCalledWith(expect.any(String), 'NS_ERROR_PROXY_CONNECTION_REFUSED')
    expect(JSON.stringify(logged.map(spy => spy.mock.calls))).not.toContain('secret')
    logged.forEach(spy => spy.mockRestore())
  })
})
