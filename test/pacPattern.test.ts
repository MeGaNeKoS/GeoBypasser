import { matchPatternSource } from '@utils/pacPattern'

const matches = (pattern: string, url: string): boolean => new RegExp(matchPatternSource(pattern)).test(url)

describe('matchPatternSource', () => {
  it('matches the host exactly and its paths', () => {
    expect(matches('*://example.com/*', 'https://example.com/a?b=1')).toBe(true)
    expect(matches('*://example.com/*', 'http://example.com')).toBe(true)
  })

  it('matches a port and userinfo on the named host', () => {
    expect(matches('*://example.com/*', 'https://example.com:8443/x')).toBe(true)
    expect(matches('*://example.com/*', 'https://user:pw@example.com/x')).toBe(true)
  })

  it('matches a wildcard subdomain and the bare domain', () => {
    expect(matches('*://*.example.com/*', 'https://a.b.example.com/x')).toBe(true)
    expect(matches('*://*.example.com/*', 'https://example.com/x')).toBe(true)
  })

  it('does not match a host that only ends with the domain', () => {
    expect(matches('*://example.com/*', 'https://notexample.com/x')).toBe(false)
    expect(matches('*://*.example.com/*', 'https://notexample.com/x')).toBe(false)
    expect(matches('*://example.com/*', 'https://example.com.evil.net/x')).toBe(false)
  })

  it('restricts a wildcard scheme to http and https', () => {
    expect(matches('*://example.com/*', 'ftp://example.com/x')).toBe(false)
  })

  it('matches a named scheme only', () => {
    expect(matches('http://example.com/*', 'https://example.com/x')).toBe(false)
    expect(matches('http://example.com/*', 'http://example.com/x')).toBe(true)
  })

  it('matches any host for a wildcard host', () => {
    expect(matches('*://*/*', 'https://anything.test/x')).toBe(true)
  })

  it('matches every supported scheme for all urls', () => {
    expect(matches('<all_urls>', 'file:///tmp/x')).toBe(true)
    expect(matches('<all_urls>', 'ftp://host/x')).toBe(true)
    expect(matches('<all_urls>', 'ws://host/x')).toBe(false)
  })

  it('treats regex characters in a host as literal text', () => {
    expect(matches('*://exa+mple.com/*', 'https://exa+mple.com/x')).toBe(true)
    expect(matches('*://exa+mple.com/*', 'https://exaample.com/x')).toBe(false)
  })
})
