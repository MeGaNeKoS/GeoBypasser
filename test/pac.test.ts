import { addTestURLToPac, _resetTestPac } from '@utils/pac'
import { browser } from './setup'

describe('PAC test helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    _resetTestPac()
  })

  it('adds and removes a test url', async () => {
    browser.proxy.settings.get.mockResolvedValueOnce({ value: { pacScript: { data: 'function FindProxyForURL(url, host) {\n  return "DIRECT";\n}' } } })
    const remove = await addTestURLToPac('https://t', 'PROXY p:1')
    expect(browser.proxy.settings.set).toHaveBeenCalledTimes(1)
    const setArg = browser.proxy.settings.set.mock.calls[0][0].value.pacScript.data as string
    expect(setArg).toContain('PROXY p:1')
    browser.proxy.settings.get.mockResolvedValueOnce({ value: { pacScript: { data: setArg } } })
    await remove()
    const finalArg = browser.proxy.settings.set.mock.calls[browser.proxy.settings.set.mock.calls.length - 1][0].value.pacScript.data
    expect(finalArg.trim()).toBe('function FindProxyForURL(url, host) {\n  return "DIRECT";\n}')
  })
})
