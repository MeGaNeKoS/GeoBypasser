import type { NetworkMessage } from '@customTypes/messages'
import { addRequestToTab, emptyTabUsage, UNKNOWN_ROUTE, type NetworkUsage, type RecordedRoute, type RequestObservation, type TabUsage } from '@utils/networkUsage'

export type RequestOutcome = Omit<RequestObservation, 'route'>;

type RoutedRequest = { tabId: number; route: RecordedRoute };

export type RouteForRequest = (requestUrl: string) => Promise<RecordedRoute>;

export function createNetworkMonitor () {
  const monitoredTabs = new Set<number>()
  const usageByTab = new Map<number, TabUsage>()
  const routeByRequest = new Map<string, RoutedRequest>()

  function isTabMonitored (tabId: number) {
    return monitoredTabs.has(tabId)
  }

  function forgetTab (tabId: number) {
    monitoredTabs.delete(tabId)
    usageByTab.delete(tabId)
    for (const [requestId, routed] of routeByRequest) {
      if (routed.tabId === tabId) routeByRequest.delete(requestId)
    }
  }

  function noteRoute (requestId: string, tabId: number, route: RecordedRoute) {
    if (!monitoredTabs.has(tabId)) return
    routeByRequest.set(requestId, { tabId, route })
  }

  function recordRequest (tabId: number, requestId: string, outcome: RequestOutcome) {
    const route = routeByRequest.get(requestId)?.route ?? UNKNOWN_ROUTE
    routeByRequest.delete(requestId)
    if (!monitoredTabs.has(tabId)) return
    addRequestToTab(tabUsageFor(tabId), { ...outcome, route })
  }

  function tabUsageFor (tabId: number): TabUsage {
    const existing = usageByTab.get(tabId)
    if (existing) return existing
    const created = emptyTabUsage()
    usageByTab.set(tabId, created)
    return created
  }

  function usageSnapshot (): NetworkUsage {
    return Object.fromEntries(usageByTab.entries()) as NetworkUsage
  }

  function answerNetworkMessage (message: NetworkMessage): unknown {
    switch (message.type) {
      case 'getNetworkStats':
        return usageSnapshot()
      case 'clearNetworkStats':
        usageByTab.clear()
        return undefined
      case 'monitorTabNetwork':
        monitoredTabs.add(message.tabId)
        return undefined
      case 'unmonitorTabNetwork':
        monitoredTabs.delete(message.tabId)
        return undefined
      case 'isTabNetworkMonitored':
        return monitoredTabs.has(message.tabId)
    }
  }

  return { isTabMonitored, forgetTab, noteRoute, recordRequest, answerNetworkMessage }
}

export type NetworkMonitor = ReturnType<typeof createNetworkMonitor>
