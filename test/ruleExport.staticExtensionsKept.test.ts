import { DIRECT_PROXY_ID } from '@constant/proxy'
import { exportedRules } from '@utils/ruleExport'

const usableRule = { active: true, name: 'files', match: ['https://example.com/*'], proxyId: 'good', fallbackDirect: true }

describe('exporting a rule whose only fault is its static extensions', () => {
  it('writes the stored static extensions text unchanged, invalid or not', () => {
    const [exported] = exportedRules([{ ...usableRule, staticExtensions: '/(/' }], () => true)
    expect(exported.staticExtensions).toBe('/(/')
  })

  it('keeps the proxy id when the caller keeps it, and the rest of the rule as stored', () => {
    const [exported] = exportedRules([{ ...usableRule, staticExtensions: '/(/' }], () => true)
    expect(exported).toMatchObject({ name: 'files', match: ['https://example.com/*'], proxyId: 'good', fallbackDirect: true })
  })

  it('replaces the proxy id with the direct choice when the caller does not keep it', () => {
    const [exported] = exportedRules([{ ...usableRule, staticExtensions: '/(/' }], () => false)
    expect(exported.proxyId).toBe(DIRECT_PROXY_ID)
    expect(exported.staticExtensions).toBe('/(/')
  })
})
