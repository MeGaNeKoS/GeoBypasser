import { answerTestProxyMessage, PROXY_NOT_FOUND_ERROR } from '@core/proxyTest'
import type { ProxyListItem } from '@customTypes/proxy'

const tokyo: ProxyListItem = { id: 'tokyo', type: 'http', host: 'tokyo.lan', port: 8080, proxyDNS: false } as any
const setAside: ProxyListItem = { id: 'broken', label: 'Broken' } as any
const settings = { proxyList: [tokyo, setAside], testProxyUrl: 'https://example.test/' } as any

describe('a saved proxy test message that cannot be answered', () => {
  it.each([
    ['an id not in the saved list', 'ghost', [tokyo]],
    ['an id that is set aside', 'broken', [tokyo, setAside]],
    ['an id with an empty proxy list', 'tokyo', []],
  ])('reports not found and runs no test for %s', async (_name, proxyId, proxyList) => {
    const runTest = jest.fn()
    const result = await answerTestProxyMessage({ type: 'testProxy', proxyId }, { ...settings, proxyList }, runTest)
    expect(result).toEqual({ success: false, error: PROXY_NOT_FOUND_ERROR, proxy: '' })
    expect(runTest).not.toHaveBeenCalled()
  })

  it('does not fall back to the default proxy for an unknown id', async () => {
    const runTest = jest.fn()
    const withDefault = { ...settings, defaultProxy: 'tokyo' }
    await answerTestProxyMessage({ type: 'testProxy', proxyId: 'ghost' }, withDefault, runTest)
    expect(runTest).not.toHaveBeenCalled()
  })
})
