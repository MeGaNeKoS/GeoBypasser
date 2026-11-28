import { isTabProxyMessage, isNetworkMessage, isTestProxyMessage } from '@utils/messages'

describe('isTestProxyMessage', () => {
  it('accepts a saved proxy by id and a custom proxy in full', () => {
    expect(isTestProxyMessage({ type: 'testProxy', proxyId: 'p1' })).toBe(true)
    expect(isTestProxyMessage({ type: 'testProxy', proxy: { id: 'c1', type: 'http', host: 'a.lan', port: 8080, proxyDNS: false } })).toBe(true)
  })
})

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
