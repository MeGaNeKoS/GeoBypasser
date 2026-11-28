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

describe('messages that are not a proxy control change leave the shown state alone', () => {
  let listener: Listener
  const received: string[] = []

  beforeAll(() => {
    onProxyControlStateChanged(state => received.push(state))
    listener = addListener.mock.calls.at(-1)?.[0] as Listener
  })

  beforeEach(() => {
    jest.clearAllMocks()
    received.length = 0
  })

  it.each([
    ['an unknown message type', { type: 'somethingElse', state: 'overridden' }],
    ['a state the schema does not know', { type: 'proxyControlChanged', state: 'bogus' }],
    ['a message without a state', { type: 'proxyControlChanged' }],
    ['no message', undefined],
  ])('does not notify the listener for %s', (_, message) => {
    listener(message)

    expect(received).toEqual([])
  })

  it('keeps asking the background when no valid change was pushed', async () => {
    listener({ type: 'proxyControlChanged', state: 'bogus' })
    sendMessage.mockResolvedValueOnce({ state: 'available' })

    await expect(readProxyControlState()).resolves.toBe('available')
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
