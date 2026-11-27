import type { ProxyListItem } from '@customTypes/proxy'
import type { KeepAliveState } from '@utils/generic'
import { testProxyConfigQueued } from '@utils/proxy'

export const KEEP_ALIVE_TEST_URL = 'https://t/'

export function keepAliveProxy (overrides: Partial<ProxyListItem> = {}): ProxyListItem {
  return { id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true, notifyIfDown: true, ...overrides }
}

export function keepAliveState (): KeepAliveState {
  return {
    activeTabs: new Map([['example.com', new Set([1])]]),
    timer: null,
    testUrl: KEEP_ALIVE_TEST_URL,
    consecutiveFailures: 0,
    reportedDown: false,
  }
}

export function answerChecksBy (outcomesByProxyId: Record<string, boolean[]>) {
  const checksAnswered: Record<string, number> = {}
  ;(testProxyConfigQueued as unknown as jest.Mock).mockImplementation((proxy: ProxyListItem, _testUrl: string, sendResult: Function) => {
    const outcomes = outcomesByProxyId[proxy.id]
    const index = checksAnswered[proxy.id] ?? 0
    checksAnswered[proxy.id] = index + 1
    const success = outcomes[Math.min(index, outcomes.length - 1)]
    sendResult(success
      ? { success: true, proxy: `${proxy.host}:${proxy.port}` }
      : { success: false, error: 'timed out', proxy: `${proxy.host}:${proxy.port}` })
  })
}

export function checkCount (): number {
  return (testProxyConfigQueued as unknown as jest.Mock).mock.calls.length
}
