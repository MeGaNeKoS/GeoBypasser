import { proxyTestOutcomeText } from '../src/utils/proxyTestOutcome'

describe('proxy test outcome text', () => {
  it('reads that no test has run yet before the first test', () => {
    expect(proxyTestOutcomeText({ state: 'idle' })).toBe('No test run yet')
  })

  it('reads that a test is running while it runs', () => {
    expect(proxyTestOutcomeText({ state: 'busy' })).toBe('Testing…')
  })

  it('names the proxy a successful test connected through', () => {
    expect(proxyTestOutcomeText({
      state: 'finished',
      result: { success: true, proxy: 'good.lan:8080' },
    })).toBe('Connected through good.lan:8080')
  })
})
