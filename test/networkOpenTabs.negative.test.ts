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

describe('the Network section ignores tab updates that change neither url nor title', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['a loading status change', { status: 'loading' }],
    ['a pinned change', { pinned: true }],
    ['an empty change', {}],
  ])('does not call the listener for %s', (_, changeInfo) => {
    const listener = jest.fn()
    onOpenTabsChanged(listener)

    lastListener(browser.tabs.onUpdated as never)(9, changeInfo, {})

    expect(listener).not.toHaveBeenCalled()
  })
})
