import { isNetworkMessage, isProxyControlMessage, isTabProxyMessage, isTestProxyMessage } from '@utils/messages'

describe('isTabProxyMessage rejects messages of the wrong shape', () => {
  it.each([
    ['setTabProxy without a proxy id', { type: 'setTabProxy', tabId: 1 }],
    ['setTabProxy with a numeric proxy id', { type: 'setTabProxy', tabId: 1, proxyId: 7 }],
    ['setTabProxy with a string tab id', { type: 'setTabProxy', tabId: '1', proxyId: 'p1' }],
    ['clearTabProxy without a tab id', { type: 'clearTabProxy' }],
    ['a message with no type', { tabId: 1, proxyId: 'p1' }],
    ['a null message', null],
    ['a string message', 'setTabProxy'],
  ])('rejects %s', (_name, msg) => {
    expect(isTabProxyMessage(msg)).toBe(false)
  })
})

describe('isNetworkMessage rejects messages of the wrong shape', () => {
  it.each([
    ['monitorTabNetwork with a string tab id', { type: 'monitorTabNetwork', tabId: '1' }],
    ['unmonitorTabNetwork without a tab id', { type: 'unmonitorTabNetwork' }],
    ['an array message', [{ type: 'getNetworkStats' }]],
  ])('rejects %s', (_name, msg) => {
    expect(isNetworkMessage(msg)).toBe(false)
  })
})

describe('isProxyControlMessage rejects messages of the wrong shape', () => {
  it.each([
    ['proxyControlChanged with an unknown state', { type: 'proxyControlChanged', state: 'bogus' }],
    ['proxyControlChanged without a state', { type: 'proxyControlChanged' }],
    ['a message whose type is not a string', { type: 5 }],
    ['a message with no type', { state: 'active' }],
    ['a null message', null],
  ])('rejects %s', (_name, msg) => {
    expect(isProxyControlMessage(msg)).toBe(false)
  })
})

describe('isTestProxyMessage rejects messages of the wrong shape', () => {
  it.each([
    ['testProxy with neither a proxy id nor a proxy', { type: 'testProxy' }],
    ['testProxy with a numeric proxy id', { type: 'testProxy', proxyId: 7 }],
    ['testProxy with a proxy that has no host', { type: 'testProxy', proxy: { id: 'x', type: 'http', port: 8080, proxyDNS: false } }],
    ['a message with no type', { proxyId: 'p1' }],
  ])('rejects %s', (_name, msg) => {
    expect(isTestProxyMessage(msg)).toBe(false)
  })
})
