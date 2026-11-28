import browser from 'webextension-polyfill'
import { onNetworkMonitoringChanged } from '../src/ui/networkMonitorState'

jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: { runtime: { sendMessage: jest.fn(), onMessage: { addListener: jest.fn() } } },
}))

type Listener = (message: unknown) => void

const addListener = browser.runtime.onMessage.addListener as unknown as jest.Mock

function listenerFromPage (): Listener {
  const listener = addListener.mock.calls.at(-1)?.[0] as Listener | undefined
  if (!listener) throw new Error('no runtime message listener registered')
  return listener
}

describe('the Network section ignores messages that are not a monitoring change', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['another message type', { type: 'proxyControlChanged', state: 'active' }],
    ['a change without a tab', { type: 'networkMonitoringChanged', monitored: true }],
    ['a change whose monitored flag is not a boolean', { type: 'networkMonitoringChanged', tabId: 3, monitored: 'yes' }],
    ['no message at all', undefined],
  ])('does not call the listener for %s', (_, message) => {
    const listener = jest.fn()
    onNetworkMonitoringChanged(listener)

    listenerFromPage()(message)

    expect(listener).not.toHaveBeenCalled()
  })
})
