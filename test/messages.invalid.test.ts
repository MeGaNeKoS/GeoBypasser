import { isNetworkMessage, isProxyControlMessage, isTabProxyMessage } from '@utils/messages'

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
    ['devtoolsNetworkData without a sent size', { type: 'devtoolsNetworkData', tabId: 1, url: 'https://a/', receivedSize: 2 }],
    ['devtoolsNetworkData with a string received size', { type: 'devtoolsNetworkData', tabId: 1, url: 'https://a/', sentSize: 1, receivedSize: '2' }],
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
