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

describe('the Network section hears a tab monitoring change pushed by the background', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hands the tab and its new monitoring state to the listener', () => {
    const received: { tabId: number; monitored: boolean }[] = []
    onNetworkMonitoringChanged(change => received.push(change))

    listenerFromPage()({ type: 'networkMonitoringChanged', tabId: 7, monitored: false })

    expect(received).toEqual([{ tabId: 7, monitored: false }])
  })
})
