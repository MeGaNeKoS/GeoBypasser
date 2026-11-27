import { isValidPattern, isValidProxyItem, isValidRule, isValidStaticExtensions, isValidTestUrl } from '@utils/validity'
import type { ProxyListItem } from '@customTypes/proxy'

function proxy (overrides: Partial<ProxyListItem>): ProxyListItem {
  return { id: 'p1', type: 'http', host: 'proxy.example', port: 8080, proxyDNS: false, ...overrides } as ProxyListItem
}

function rule (overrides: Record<string, unknown> = {}): any {
  return { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1', ...overrides }
}

describe('isValidPattern', () => {
  it('accepts a URL match pattern and the all urls pattern', () => {
    expect(isValidPattern('https://example.com/*')).toBe(true)
    expect(isValidPattern('<all_urls>')).toBe(true)
  })
})

describe('isValidProxyItem', () => {
  it('accepts a host with an underscore and a host padded with spaces', () => {
    expect(isValidProxyItem(proxy({ host: 'proxy_1.lan' }))).toBe(true)
    expect(isValidProxyItem(proxy({ host: '  proxy.example  ' }))).toBe(true)
  })
})

describe('isValidRule', () => {
  it('accepts a rule whose proxy is not in the list', () => {
    expect(isValidRule(rule({ proxyId: 'gone' }))).toBe(true)
  })
})

describe('isValidStaticExtensions', () => {
  it('accepts an absent or empty value', () => {
    expect(isValidStaticExtensions(undefined)).toBe(true)
    expect(isValidStaticExtensions('')).toBe(true)
  })

  it('accepts a /pattern/flags value where the pattern compiles', () => {
    expect(isValidStaticExtensions('/\\.(png|css)$/')).toBe(true)
    expect(isValidStaticExtensions('/\\.(png|css)$/gi')).toBe(true)
  })
})

describe('isValidTestUrl', () => {
  it('accepts an absolute http or https URL', () => {
    expect(isValidTestUrl('https://www.google.com/')).toBe(true)
    expect(isValidTestUrl('http://example.com/ping')).toBe(true)
  })
})
