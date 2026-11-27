import { isValidKeepAliveRule, isValidPattern, isValidProxyItem, isValidRule, isValidStaticExtensions, isValidTestUrl } from '@utils/validity'
import type { ProxyListItem } from '@customTypes/proxy'

function proxy (overrides: Partial<ProxyListItem>): ProxyListItem {
  return { id: 'p1', type: 'http', host: 'proxy.example', port: 8080, proxyDNS: false, ...overrides } as ProxyListItem
}

function rule (overrides: Record<string, unknown> = {}): any {
  return { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1', ...overrides }
}

describe('isValidPattern', () => {
  it('rejects text that is not a match pattern', () => {
    expect(isValidPattern('not a pattern')).toBe(false)
  })

  it('rejects a port in a match pattern', () => {
    expect(isValidPattern('https://example.com:8080/*')).toBe(false)
  })

  it('rejects values that are not strings', () => {
    expect(isValidPattern(42)).toBe(false)
    expect(isValidPattern(undefined)).toBe(false)
  })
})

describe('isValidProxyItem', () => {
  it('rejects hosts that contain separators or quotes', () => {
    expect(isValidProxyItem(proxy({ host: 'a:1; PROXY x:8080' }))).toBe(false)
    for (const host of ['a/b', 'a\\b', 'a"b', "a'b"]) {
      expect(isValidProxyItem(proxy({ host }))).toBe(false)
    }
  })

  it('rejects an empty host and a whitespace only host', () => {
    expect(isValidProxyItem(proxy({ host: '' }))).toBe(false)
    expect(isValidProxyItem(proxy({ host: '   ' }))).toBe(false)
  })

  it('rejects ports outside 1 to 65535 and non integer ports', () => {
    expect(isValidProxyItem(proxy({ port: 70000 }))).toBe(false)
    expect(isValidProxyItem(proxy({ port: 0 }))).toBe(false)
    expect(isValidProxyItem(proxy({ port: 8080.5 }))).toBe(false)
    expect(isValidProxyItem(proxy({ port: 65535 }))).toBe(true)
  })

  it('rejects values that are not objects', () => {
    expect(isValidProxyItem('proxy')).toBe(false)
    expect(isValidProxyItem(null)).toBe(false)
  })
})

describe('isValidRule', () => {
  it('rejects a rule without a name', () => {
    expect(isValidRule(rule({ name: '' }))).toBe(false)
  })

  it('rejects a rule with no match patterns', () => {
    expect(isValidRule(rule({ match: [] }))).toBe(false)
  })

  it('accepts a rule whose staticExtensions value is not valid', () => {
    expect(isValidRule(rule({ staticExtensions: '\\.(png|css)$' }))).toBe(true)
  })

  it('rejects a rule with an invalid match pattern', () => {
    expect(isValidRule(rule({ match: ['https://example.com:8080/*'] }))).toBe(false)
  })

  it('rejects a rule with an invalid bypass or force pattern', () => {
    expect(isValidRule(rule({ bypassUrlPatterns: ['not a pattern'] }))).toBe(false)
    expect(isValidRule(rule({ forceProxyUrlPatterns: ['not a pattern'] }))).toBe(false)
  })

  it('rejects a rule without a proxy reference', () => {
    expect(isValidRule(rule({ proxyId: undefined }))).toBe(false)
  })

  it('rejects a value that is not an object', () => {
    expect(isValidRule('rule')).toBe(false)
    expect(isValidRule(null)).toBe(false)
  })
})

describe('isValidStaticExtensions', () => {
  it('rejects a value without slashes', () => {
    expect(isValidStaticExtensions('\\.(png|css)$')).toBe(false)
  })

  it('rejects a pattern that does not compile', () => {
    expect(isValidStaticExtensions('/(/')).toBe(false)
  })

  it('rejects repeated flags', () => {
    expect(isValidStaticExtensions('/x/gg')).toBe(false)
  })

  it('rejects flags outside gimsuy', () => {
    expect(isValidStaticExtensions('/x/q')).toBe(false)
  })
})

describe('isValidTestUrl', () => {
  it('rejects a URL without a scheme', () => {
    expect(isValidTestUrl('www.google.com')).toBe(false)
  })

  it('rejects a non http scheme and a value that is not a string', () => {
    expect(isValidTestUrl('ftp://example.com/')).toBe(false)
    expect(isValidTestUrl(undefined)).toBe(false)
  })
})

describe('isValidRule with bypassResourceTypes that are not known names', () => {
  it.each([
    ['an unknown name', ['not-a-type']],
    ['a list with one unknown name', ['script', 'unknown']],
    ['a value that is not a list', 'script'],
  ])('rejects %s', (_, bypassResourceTypes) => {
    expect(isValidRule(rule({ bypassResourceTypes }))).toBe(false)
  })
})

describe('isValidKeepAliveRule with no tab URL pattern', () => {
  it('rejects a rule whose tabUrls list is empty', () => {
    expect(isValidKeepAliveRule({ active: true, tabUrls: [] })).toBe(false)
  })
})
