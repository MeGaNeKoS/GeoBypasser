import type { ProxyListItem, ProxyTestResult } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { TestProxyMessage } from '@customTypes/messages'
import { usableProxies } from '@utils/usable'

export type ProxyTestRunner = (proxy: ProxyListItem, testUrl: string) => Promise<ProxyTestResult>

export const PROXY_NOT_FOUND_ERROR = 'Proxy not found'

const NOT_FOUND_RESULT: ProxyTestResult = { success: false, error: PROXY_NOT_FOUND_ERROR, proxy: '' }

export function answerTestProxyMessage (
  message: TestProxyMessage,
  settings: GeoBypassRuntimeSettings,
  runTest: ProxyTestRunner,
): Promise<ProxyTestResult> {
  const proxy = proxyForTestMessage(message, settings.proxyList)
  if (proxy === undefined) return Promise.resolve(NOT_FOUND_RESULT)
  return runTest(proxy, settings.testProxyUrl)
}

function proxyForTestMessage (message: TestProxyMessage, proxyList: ProxyListItem[]): ProxyListItem | undefined {
  if ('proxy' in message) return message.proxy
  return usableProxies(proxyList).find(proxy => proxy.id === message.proxyId)
}
