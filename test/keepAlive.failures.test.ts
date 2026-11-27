import { maybeUpdateProxyKeepAlive } from '@core/keepAlive'
import { browser } from './setup'
import { answerChecksBy, keepAliveProxy, keepAliveState } from './keepAliveHarness'

jest.mock('@utils/proxy', () => ({ ...jest.requireActual('@utils/proxy'), testProxyConfigQueued: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function createdNotifications () {
  return (browser.notifications.create as jest.Mock).mock.calls as [string, { message: string }][]
}

describe('a proxy that fails three checks in a row', () => {
  it('is reported down once, on the third failure', () => {
    answerChecksBy({ p1: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(10000)

    expect(createdNotifications().map(([id]) => id)).toEqual(['proxy-down-p1'])
  })

  it('sends no further notification while it stays down', () => {
    answerChecksBy({ p1: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(30000)

    expect(createdNotifications()).toHaveLength(1)
  })
})

describe('a proxy that recovers after being reported down', () => {
  it('is reported back once, and its down notice is cleared', () => {
    answerChecksBy({ p1: [false, false, false, true, true] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(30000)

    expect(createdNotifications().map(([id]) => id)).toEqual(['proxy-down-p1', 'proxy-back-p1'])
    expect(browser.notifications.clear).toHaveBeenCalledWith('proxy-down-p1')
  })

  it('starts its failure count from zero, so two failures after recovery are silent', () => {
    answerChecksBy({ p1: [false, false, false, true, false, false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy(), keepAliveState())
    jest.advanceTimersByTime(25000)

    expect(createdNotifications().map(([id]) => id)).toEqual(['proxy-down-p1', 'proxy-back-p1'])
  })
})

describe('notice text', () => {
  it('names the proxy by its label', () => {
    answerChecksBy({ p1: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy({ label: 'Office VPN' }), keepAliveState())
    jest.advanceTimersByTime(10000)

    expect(createdNotifications()[0][1].message).toContain('Office VPN')
  })

  it('names the proxy by host and port when it has no label', () => {
    answerChecksBy({ p1: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy({ host: 'proxy.example', port: 8080 }), keepAliveState())
    jest.advanceTimersByTime(10000)

    expect(createdNotifications()[0][1].message).toContain('proxy.example:8080')
  })
})

describe('notices across proxies', () => {
  it('gives each proxy its own down notice id', () => {
    answerChecksBy({ p1: [false], p2: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy({ id: 'p1' }), keepAliveState())
    maybeUpdateProxyKeepAlive(keepAliveProxy({ id: 'p2', host: 'other' }), keepAliveState())
    jest.advanceTimersByTime(10000)

    expect(createdNotifications().map(([id]) => id).sort()).toEqual(['proxy-down-p1', 'proxy-down-p2'])
  })

  it('clears only the recovered proxy\'s down notice while another proxy stays down', () => {
    answerChecksBy({ p1: [false, false, false, true], p2: [false] })
    maybeUpdateProxyKeepAlive(keepAliveProxy({ id: 'p1' }), keepAliveState())
    maybeUpdateProxyKeepAlive(keepAliveProxy({ id: 'p2', host: 'other' }), keepAliveState())
    jest.advanceTimersByTime(15000)

    expect(browser.notifications.clear).toHaveBeenCalledTimes(1)
    expect(browser.notifications.clear).toHaveBeenCalledWith('proxy-down-p1')
    expect(createdNotifications().map(([id]) => id)).toContain('proxy-back-p1')
    expect(createdNotifications().map(([id]) => id)).not.toContain('proxy-back-p2')
  })
})
