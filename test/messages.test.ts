import { isTabProxyMessage } from '@utils/messages'

describe('isTabProxyMessage', () => {
  it('validates messages correctly', () => {
    expect(isTabProxyMessage({ type: 'setTabProxy', tabId: 1, proxyId: 'p1' })).toBe(true)
    expect(isTabProxyMessage({ type: 'clearTabProxy', tabId: 1 })).toBe(true)
    expect(isTabProxyMessage({ type: 'foo' })).toBe(false)
    expect(isTabProxyMessage({})).toBe(false)
  })
})
