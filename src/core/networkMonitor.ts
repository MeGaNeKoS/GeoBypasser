import type { NetworkMessage } from '@customTypes/messages'
import { addRequestToTab, emptyTabUsage, FAILED_BEFORE_ROUTE, UNKNOWN_ROUTE, type NetworkUsage, type RecordedRoute, type RequestObservation, type TabUsage } from '@utils/networkUsage'
import { DIRECT_ROUTE } from '@utils/pacRoute'
import { networkUsageToWire } from '@schemas/networkUsage'

export type RequestOutcome = Omit<RequestObservation, 'route'> & { observedRoute?: string; expectedRoute?: RecordedRoute; failedBeforeRoute?: boolean };

const NO_LISTENER_ROUTE: RecordedRoute = { reason: 'default', route: DIRECT_ROUTE, expected: false };

type RouteCandidate = { precedence: number; route: RecordedRoute };

export type RouteForRequest = (requestUrl: string) => Promise<RecordedRoute>;

export function createNetworkMonitor (
  broadcastMonitoring: (tabId: number, monitored: boolean) => void,
  notifyUsageChanged: () => void = () => {},
) {
  const monitoredTabs = new Set<number>()
  const usageByTab = new Map<number, TabUsage>()
  const candidatesByTab = new Map<number, Map<string, RouteCandidate[]>>()
  const topLevelPageUrlByTab = new Map<number, string>()

  function isTabMonitored (tabId: number) {
    return monitoredTabs.has(tabId)
  }

  function forgetTab (tabId: number) {
    const wasMonitored = monitoredTabs.delete(tabId)
    usageByTab.delete(tabId)
    candidatesByTab.delete(tabId)
    topLevelPageUrlByTab.delete(tabId)
    if (wasMonitored) broadcastMonitoring(tabId, false)
  }

  function noteTopLevelPage (tabId: number, pageUrl: string) {
    if (!monitoredTabs.has(tabId)) return
    topLevelPageUrlByTab.set(tabId, pageUrl)
  }

  function topLevelPageUrlOf (tabId: number): string | undefined {
    return topLevelPageUrlByTab.get(tabId)
  }

  function noteRoute (requestId: string, tabId: number, route: RecordedRoute, precedence = 0) {
    if (!monitoredTabs.has(tabId)) return
    const requests = candidatesByTab.get(tabId) ?? new Map<string, RouteCandidate[]>()
    candidatesByTab.set(tabId, requests)
    requests.set(requestId, [...(requests.get(requestId) ?? []), { precedence, route }])
  }

  function recordRequest (tabId: number, requestId: string, outcome: RequestOutcome) {
    const { observedRoute, expectedRoute, failedBeforeRoute, ...observation } = outcome
    const requests = candidatesByTab.get(tabId)
    const candidates = requests?.get(requestId) ?? []
    requests?.delete(requestId)
    if (!monitoredTabs.has(tabId)) return
    const route = failedBeforeRoute ? FAILED_BEFORE_ROUTE : expectedRoute ?? routeOfRequest(observation.error, settleRoute(candidates, observedRoute))
    addRequestToTab(tabUsageFor(tabId), { ...observation, route })
    notifyUsageChanged()
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
        return networkUsageToWire(usageSnapshot())
      case 'clearNetworkStats':
        usageByTab.clear()
        return undefined
      case 'monitorTabNetwork':
        monitoredTabs.add(message.tabId)
        broadcastMonitoring(message.tabId, true)
        return undefined
      case 'unmonitorTabNetwork':
        monitoredTabs.delete(message.tabId)
        broadcastMonitoring(message.tabId, false)
        return undefined
      case 'isTabNetworkMonitored':
        return monitoredTabs.has(message.tabId)
    }
  }

  return { isTabMonitored, forgetTab, noteRoute, noteTopLevelPage, topLevelPageUrlOf, recordRequest, answerNetworkMessage }
}

function settleRoute (candidates: RouteCandidate[], observedRoute: string | undefined): RecordedRoute {
  const byPrecedence = [...candidates].sort((a, b) => a.precedence - b.precedence)
  const preferred = byPrecedence[0]?.route
  if (observedRoute === undefined) return preferred ? inferredRoute(preferred) : UNKNOWN_ROUTE
  const matching = byPrecedence.find(candidate => candidate.route.route === observedRoute)
  if (matching) return matching.route
  if (observedRoute === DIRECT_ROUTE && candidates.length === 0) return NO_LISTENER_ROUTE
  return { reason: 'unknown', route: observedRoute, expected: false }
}

function routeOfRequest (error: string | undefined, settled: RecordedRoute): RecordedRoute {
  return error !== undefined && settled === UNKNOWN_ROUTE ? FAILED_BEFORE_ROUTE : settled;
}

function inferredRoute (route: RecordedRoute): RecordedRoute {
  return { ...route, inferred: true }
}

export type NetworkMonitor = ReturnType<typeof createNetworkMonitor>
