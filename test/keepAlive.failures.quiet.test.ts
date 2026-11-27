import { browser } from './setup'
import { answerChecksBy, keepAliveProxy, keepAliveState, maybeUpdateProxyKeepAlive } from './keepAliveHarness'

jest.mock('@utils/proxy', () => ({ ...jest.requireActual('@utils/proxy'), testProxyConfigQueued: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('a proxy that fails one or two checks', () => {
  it('sends no notification when it passes again', () => {
    answerChecksBy({ p1: [false, false, true] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(10000)

    expect(browser.notifications.create).not.toHaveBeenCalled()
  })

  it('sends no notification when it recovers before a third failure and fails again', () => {
    answerChecksBy({ p1: [false, false, true, false, false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(20000)

    expect(browser.notifications.create).not.toHaveBeenCalled()
    expect(browser.notifications.clear).not.toHaveBeenCalled()
  })
})

describe('a proxy with notify if down off', () => {
  it('sends no notification when it is down or comes back', () => {
    answerChecksBy({ p1: [false, false, false, true] })
    maybeUpdateProxyKeepAlive(keepAliveProxy({ notifyIfDown: false }), keepAliveState())
    jest.advanceTimersByTime(15000)

    expect(browser.notifications.create).not.toHaveBeenCalled()
    expect(browser.notifications.clear).not.toHaveBeenCalled()
  })
})
