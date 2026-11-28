import { refreshInBackground } from '../src/ui/network/liveRefresh'

describe('a failed live Network refresh', () => {
  it('logs the reason and does not reject into the page', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const failure = new Error('context invalidated')

    refreshInBackground(() => Promise.reject(failure), 'refresh failed')
    await new Promise(done => setImmediate(done))

    expect(errorSpy).toHaveBeenCalledWith('refresh failed', failure)
    errorSpy.mockRestore()
  })
})
