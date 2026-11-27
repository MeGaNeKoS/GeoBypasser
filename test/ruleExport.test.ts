import { exportedRule, exportedRules } from '@utils/ruleExport'

const rule = {
  active: false, name: 'Example', match: ['*://a.example/*'], proxyId: 'p1',
  bypassUrlPatterns: ['*://skip.example/*'], bypassResourceTypes: ['script'],
  staticExtensions: '/\\.png$/', forceProxyUrlPatterns: [], fallbackDirect: true,
  compiledMatch: 'compiled',
}

describe('an exported rule keeps the stored fields', () => {
  it('keeps the proxy id when asked to', () => {
    expect(exportedRule(rule, true)).toEqual({
      active: false, proxyId: 'p1', name: 'Example', match: ['*://a.example/*'],
      bypassUrlPatterns: ['*://skip.example/*'], bypassResourceTypes: ['script'],
      staticExtensions: '/\\.png$/', forceProxyUrlPatterns: [], fallbackDirect: true,
    })
  })

  it('exports a rule as direct when the proxy id is not kept', () => {
    expect(exportedRule(rule, false)?.proxyId).toBe('direct')
  })

  it('exports a rule without an active flag as active', () => {
    expect(exportedRule({ ...rule, active: undefined }, true)?.active).toBe(true)
  })

  it('keeps only the rules whose proxy id is kept', () => {
    const exported = exportedRules([rule, { ...rule, proxyId: 'p2' }], proxyId => proxyId === 'p1')
    expect(exported.map(entry => entry.proxyId)).toEqual(['p1', 'direct'])
  })
})
