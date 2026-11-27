import { isInRuleScope } from '@utils/ruleScope'

const image = { type: 'image', tabId: 4, documentUrl: 'https://news.site.example/story' }

describe('a request outside a rule scope', () => {
  it('is out of scope when its resource type is not listed', () => {
    expect(isInRuleScope({ ...image, type: 'script' }, { proxyOnlyResourceTypes: ['image'] })).toBe(false)
  })

  it('is out of scope when its page is off the listed hosts', () => {
    expect(isInRuleScope(image, { proxyOnlyPageHostnames: ['other.example'] })).toBe(false)
  })

  it('is out of scope when a listed host only ends the same way as the page host', () => {
    expect(isInRuleScope({ ...image, documentUrl: 'https://notsite.example/' }, { proxyOnlyPageHostnames: ['site.example'] })).toBe(false)
  })

  it('is out of scope when the page is limited and the request has no document URL', () => {
    expect(isInRuleScope({ type: 'image', tabId: 4 }, { proxyOnlyPageHostnames: ['site.example'] })).toBe(false)
  })

  it('is out of scope when the request has no tab', () => {
    expect(isInRuleScope({ ...image, tabId: -1 }, { proxyOnlyPageHostnames: ['site.example'] })).toBe(false)
  })

  it('is out of scope when the document URL is not a URL', () => {
    expect(isInRuleScope({ ...image, documentUrl: 'not a url' }, { proxyOnlyPageHostnames: ['site.example'] })).toBe(false)
  })
})
