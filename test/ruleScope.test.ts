import { isInRuleScope } from '@utils/ruleScope'

const image = { type: 'image', tabId: 4, documentUrl: 'https://news.site.example/story' }

describe('a request inside a rule scope', () => {
  it('is in scope when the rule sets no limits', () => {
    expect(isInRuleScope(image, {})).toBe(true)
  })

  it('is in scope when the resource type list is empty', () => {
    expect(isInRuleScope({ ...image, type: 'script' }, { proxyOnlyResourceTypes: [] })).toBe(true)
  })

  it('is in scope when its resource type is listed', () => {
    expect(isInRuleScope(image, { proxyOnlyResourceTypes: ['script', 'image'] })).toBe(true)
  })

  it('is in scope when its page is on a listed host', () => {
    expect(isInRuleScope(image, { proxyOnlyPageHostnames: ['site.example'] })).toBe(true)
  })

  it('is in scope when its page is on a subdomain of a listed host', () => {
    expect(isInRuleScope(image, { proxyOnlyPageHostnames: ['example'] })).toBe(true)
    expect(isInRuleScope(image, { proxyOnlyPageHostnames: ['*.site.example'] })).toBe(true)
  })

  it('is in scope when the page list is empty, even with no page', () => {
    expect(isInRuleScope({ type: 'image', tabId: -1 }, { proxyOnlyPageHostnames: [] })).toBe(true)
  })

  it('matches listed hostnames without regard to case or surrounding space', () => {
    expect(isInRuleScope(image, { proxyOnlyPageHostnames: [' SITE.example '] })).toBe(true)
  })
})
