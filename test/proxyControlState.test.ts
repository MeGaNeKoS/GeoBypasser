import browser from 'webextension-polyfill'
import { onProxyControlStateChanged, readProxyControlState } from '../src/ui/proxyControlState'

jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: { runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } } },
}))
jest.mock('@utils/env', () => ({ supportsProxyOnRequest: false }))

type Listener = (message: unknown) => void

const sendMessage = browser.runtime.sendMessage as unknown as jest.Mock
const addListener = browser.runtime.onMessage.addListener as unknown as jest.Mock

function listenerFromPage (): Listener {
  const listener = addListener.mock.calls.at(-1)?.[0] as Listener | undefined
  if (!listener) throw new Error('no runtime message listener registered')
  return listener
}

describe('the proxy control state shown on extension pages follows pushed changes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reads the state from the background before any change is pushed', async () => {
    sendMessage.mockResolvedValueOnce({ state: 'active' })

    await expect(readProxyControlState()).resolves.toBe('active')
    expect(sendMessage).toHaveBeenCalledWith({ type: 'getProxyControl' })
  })

  it('hands a pushed state to the listener and answers later reads with it', async () => {
    const received: string[] = []
    onProxyControlStateChanged(state => received.push(state))
    sendMessage.mockResolvedValue({ state: 'active' })

    listenerFromPage()({ type: 'proxyControlChanged', state: 'overridden' })

    expect(received).toEqual(['overridden'])
    await expect(readProxyControlState()).resolves.toBe('overridden')
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
