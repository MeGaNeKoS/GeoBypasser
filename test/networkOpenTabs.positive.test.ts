import browser from 'webextension-polyfill'
import { onOpenTabsChanged } from '../src/ui/networkMonitorState'

jest.mock('webextension-polyfill', () => ({
  __esModule: true,
  default: {
    tabs: {
      onCreated: { addListener: jest.fn(), removeListener: jest.fn() },
      onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
      onUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  },
}))

type Listener = (...args: unknown[]) => void

function lastListener (event: { addListener: jest.Mock }): Listener {
  const listener = event.addListener.mock.calls.at(-1)?.[0] as Listener | undefined
  if (!listener) throw new Error('no tab listener registered')
  return listener
}

describe('the Network section re-reads when the set of open tabs changes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls the listener when a tab opens and when a tab closes', () => {
    const listener = jest.fn()
    onOpenTabsChanged(listener)

    lastListener(browser.tabs.onCreated as never)({ id: 9 })
    lastListener(browser.tabs.onRemoved as never)(9, {})

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('calls the listener when a tab changes its url or title', () => {
    const listener = jest.fn()
    onOpenTabsChanged(listener)

    lastListener(browser.tabs.onUpdated as never)(9, { url: 'https://example.test/' }, {})
    lastListener(browser.tabs.onUpdated as never)(9, { title: 'Example' }, {})

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('removes all three tab listeners when the returned stop function is called', () => {
    const stop = onOpenTabsChanged(() => {})
    const created = lastListener(browser.tabs.onCreated as never)
    const removed = lastListener(browser.tabs.onRemoved as never)
    const updated = lastListener(browser.tabs.onUpdated as never)

    stop()

    expect(browser.tabs.onCreated.removeListener).toHaveBeenCalledWith(created)
    expect(browser.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removed)
    expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updated)
  })
})
