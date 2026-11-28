import { proxyTestPanelOf, testFailureReason } from '../src/utils/proxyTestOutcome'

describe('proxy test panel', () => {
  it('shows that no test has run before the first test', () => {
    expect(proxyTestPanelOf({ state: 'idle' })).toEqual({ kind: 'idle' })
  })

  it('shows that a test is running while it runs', () => {
    expect(proxyTestPanelOf({ state: 'busy' })).toEqual({ kind: 'busy' })
  })

  it('names the proxy a successful test connected through', () => {
    expect(proxyTestPanelOf({
      state: 'finished',
      result: { success: true, proxy: 'good.lan:8080' },
    })).toEqual({ kind: 'connected', proxy: 'good.lan:8080' })
  })
})

describe('proxy test failure reason', () => {
  it('keeps the timeout message of a test that timed out', () => {
    const timeout = new Error('Connection timed out (proxy did not respond within 5 seconds)')
    timeout.name = 'AbortError'
    expect(testFailureReason(timeout)).toBe('Connection timed out (proxy did not respond within 5 seconds)')
  })
})
