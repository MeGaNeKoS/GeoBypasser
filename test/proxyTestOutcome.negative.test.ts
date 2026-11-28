import { proxyTestOutcomeText } from '../src/utils/proxyTestOutcome'

describe('proxy test outcome text for a failed test', () => {
  it('reports the failure with the reason the test gave', () => {
    expect(proxyTestOutcomeText({
      state: 'finished',
      result: { success: false, proxy: 'bad.lan:8080', error: 'connection refused' },
    })).toBe('Failed: connection refused')
  })
})
