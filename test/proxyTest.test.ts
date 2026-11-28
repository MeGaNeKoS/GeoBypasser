import { answerTestProxyMessage } from '@core/proxyTest'
import type { ProxyListItem, ProxyTestResult } from '@customTypes/proxy'

const tokyo: ProxyListItem = { id: 'tokyo', type: 'http', host: 'tokyo.lan', port: 8080, proxyDNS: false } as any
const custom: ProxyListItem = { id: 'custom-1', type: 'socks', host: 'custom.lan', port: 1080, proxyDNS: true, username: 'u', password: 'secret' } as any
const TEST_URL = 'https://example.test/'
const settings = { proxyList: [tokyo], testProxyUrl: TEST_URL } as any
const PASSED: ProxyTestResult = { success: true, proxy: 'tokyo.lan:8080' }

describe('a saved proxy test message', () => {
  it('runs the test on the saved proxy with the configured test URL', async () => {
    const runTest = jest.fn().mockResolvedValue(PASSED)
    const result = await answerTestProxyMessage({ type: 'testProxy', proxyId: 'tokyo' }, settings, runTest)
    expect(runTest).toHaveBeenCalledWith(tokyo, TEST_URL)
    expect(result).toBe(PASSED)
  })
})

describe('a custom proxy test message', () => {
  it('runs the test on the proxy it carries, without looking it up in the saved list', async () => {
    const runTest = jest.fn().mockResolvedValue(PASSED)
    await answerTestProxyMessage({ type: 'testProxy', proxy: custom }, settings, runTest)
    expect(runTest).toHaveBeenCalledWith(custom, TEST_URL)
  })
})
