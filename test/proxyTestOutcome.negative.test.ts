import { proxyTestPanelOf, testFailureReason } from '../src/utils/proxyTestOutcome'

describe('proxy test panel for a failed test', () => {
  it('gives the reason the test reported without a connected state', () => {
    expect(proxyTestPanelOf({
      state: 'finished',
      result: { success: false, proxy: 'bad.lan:8080', error: 'connection refused' },
    })).toEqual({ kind: 'failed', reason: 'connection refused' })
  })
})

describe('proxy test failure reason for a request that got no response', () => {
  it('replaces the browser error of a failed request with the no response reason', () => {
    expect(testFailureReason(new TypeError('Failed to fetch'))).toBe('no response through this proxy.')
  })

  it('gives the no response reason for a thrown value that is not an error', () => {
    expect(testFailureReason('boom')).toBe('no response through this proxy.')
  })
})
