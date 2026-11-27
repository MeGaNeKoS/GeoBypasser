import { browser } from './setup'
import { jest } from '@jest/globals'

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('Chrome proxy control', () => {
  let addAuth: jest.Mock

  beforeAll(async () => {
    addAuth = jest.fn()
    Object.assign(global, { chrome: { webRequest: { onAuthRequired: { addListener: addAuth } } } })
    browser.proxy.settings.get.mockImplementation(async () => ({ value: {}, levelOfControl: 'controlled_by_this_extension' }))
    await import('../src/background.chrome')
    await flush()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('answers a request with the current state', async () => {
    browser.proxy.settings.get.mockImplementation(async () => ({ value: {}, levelOfControl: 'controlled_by_other_extensions' }))

    const response = await browser.runtime.sendMessage({ type: 'getProxyControl' })

    expect(response).toEqual({ state: 'overridden' })
  })

  it('broadcasts a level change to the pages without a request', async () => {
    const [onChange] = browser.proxy.settings.onChange._listeners

    await onChange({ value: {}, levelOfControl: 'controlled_by_other_extensions' })

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'proxyControlChanged', state: 'overridden' })
  })

  it('re-applies the PAC script when control is regained', async () => {
    const [onChange] = browser.proxy.settings.onChange._listeners

    await onChange({ value: {}, levelOfControl: 'controllable_by_this_extension' })

    expect(browser.proxy.settings.set).toHaveBeenCalledWith({
      value: expect.objectContaining({ mode: 'pac_script' }),
    })
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'proxyControlChanged', state: 'available' })
  })

  it('does not re-apply the PAC script while another extension holds control', async () => {
    const [onChange] = browser.proxy.settings.onChange._listeners

    await onChange({ value: {}, levelOfControl: 'controlled_by_other_extensions' })

    expect(browser.proxy.settings.set).not.toHaveBeenCalled()
  })

  it('does not register another auth listener on re-apply', async () => {
    const [onChange] = browser.proxy.settings.onChange._listeners

    await onChange({ value: {}, levelOfControl: 'controllable_by_this_extension' })
    await onChange({ value: {}, levelOfControl: 'controllable_by_this_extension' })

    expect(addAuth).not.toHaveBeenCalled()
  })
})
