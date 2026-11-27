import { isRuleShownInvalid, isProxyShownInvalid } from '@utils/validity'

function rule (overrides: Record<string, unknown> = {}): any {
  return { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1', ...overrides }
}

describe('isRuleShownInvalid', () => {
  it('is true for a set aside rule', () => {
    expect(isRuleShownInvalid(rule({ match: ['not a pattern'] }))).toBe(true)
  })

  it('is true for a rule with an invalid staticExtensions value', () => {
    expect(isRuleShownInvalid(rule({ staticExtensions: '/(/' }))).toBe(true)
  })
})

describe('isProxyShownInvalid', () => {
  it('is true for a set aside proxy', () => {
    expect(isProxyShownInvalid({ id: 'p1', type: 'http', host: 'a:1; PROXY x:8080', port: 80, proxyDNS: false } as any)).toBe(true)
  })
})
