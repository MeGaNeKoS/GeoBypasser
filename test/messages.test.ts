import { isTabProxyMessage, isNetworkMessage } from '@utils/messages'

describe('isTabProxyMessage', () => {
  it('validates messages correctly', () => {
    expect(isTabProxyMessage({ type: 'setTabProxy', tabId: 1, proxyId: 'p1' })).toBe(true)
    expect(isTabProxyMessage({ type: 'clearTabProxy', tabId: 1 })).toBe(true)
    expect(isTabProxyMessage({ type: 'foo' })).toBe(false)
    expect(isTabProxyMessage({})).toBe(false)
  })
})

describe('isNetworkMessage', () => {
  it('validates messages correctly', () => {
    expect(isNetworkMessage({ type: 'monitorTabNetwork', tabId: 1 })).toBe(true)
    expect(isNetworkMessage({ type: 'unmonitorTabNetwork', tabId: 1 })).toBe(true)
    expect(isNetworkMessage({ type: 'isTabNetworkMonitored', tabId: 1 })).toBe(true)
    expect(isNetworkMessage({ type: 'getNetworkStats' })).toBe(true)
    expect(isNetworkMessage({ type: 'clearNetworkStats' })).toBe(true)
    expect(isNetworkMessage({ type: 'foo' })).toBe(false)
    expect(isNetworkMessage({})).toBe(false)
  })
})
