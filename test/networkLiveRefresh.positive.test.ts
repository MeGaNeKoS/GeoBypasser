import { refreshInBackground } from '../src/ui/network/liveRefresh'

describe('a live Network refresh runs in the background', () => {
  it('starts the refresh and logs nothing when it succeeds', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const refresh = jest.fn(() => Promise.resolve())

    refreshInBackground(refresh, 'refresh failed')
    await new Promise(done => setImmediate(done))

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
