import { browser } from './setup'
import { answerChecksBy, checkCount, keepAliveProxy, keepAliveState, maybeUpdateProxyKeepAlive } from './keepAliveHarness'

jest.mock('@utils/proxy', () => ({ ...jest.requireActual('@utils/proxy'), testProxyConfigQueued: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('check cadence after a failed check', () => {
  it('checks again within five seconds', () => {
    answerChecksBy({ p1: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(0)
    expect(checkCount()).toBe(1)

    jest.advanceTimersByTime(4999)
    expect(checkCount()).toBe(1)

    jest.advanceTimersByTime(1)
    expect(checkCount()).toBe(2)
  })

  it('reports a proxy that stays down within fifteen seconds of its first failed check', () => {
    answerChecksBy({ p1: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(0)

    jest.advanceTimersByTime(9999)
    expect(browser.notifications.create).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(browser.notifications.create).toHaveBeenCalledTimes(1)
  })
})

describe('check cadence after a passed check', () => {
  it('checks again fifteen seconds later', () => {
    answerChecksBy({ p1: [true] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(0)
    expect(checkCount()).toBe(1)

    jest.advanceTimersByTime(14999)
    expect(checkCount()).toBe(1)

    jest.advanceTimersByTime(1)
    expect(checkCount()).toBe(2)
  })
})
