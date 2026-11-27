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
  it('is true for a set aside proxy and false for a valid one', () => {
    const base = { id: 'p1', type: 'http', port: 80, proxyDNS: false }
    expect(isProxyShownInvalid({ ...base, host: 'a:1; PROXY x:8080' } as any)).toBe(true)
    expect(isProxyShownInvalid({ ...base, host: 'proxy_1.lan' } as any)).toBe(false)
  })
})
