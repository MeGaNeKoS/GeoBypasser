import { isProxyShownInvalid, isRuleShownInvalid } from '@utils/validity'

function rule (overrides: Record<string, unknown> = {}): any {
  return { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1', ...overrides }
}

describe('isRuleShownInvalid', () => {
  it('is false for a valid rule', () => {
    expect(isRuleShownInvalid(rule({ staticExtensions: '/\\.png$/' }))).toBe(false)
  })
})

describe('isProxyShownInvalid', () => {
  it('is false for a valid proxy', () => {
    expect(isProxyShownInvalid({ id: 'p1', type: 'http', host: 'proxy_1.lan', port: 80, proxyDNS: false } as any)).toBe(false)
  })
})
