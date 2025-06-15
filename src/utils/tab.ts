import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { resolveProxy, testProxyConfigQueued } from '@utils/proxy'
import browser, { Tabs } from 'webextension-polyfill'
import { getHostname, KeepAliveState, matchHostname } from '@utils/generic'
import { ProxyListItem, ProxyListRuntimeItem } from '@customTypes/proxy'
import OnUpdatedChangeInfoType = Tabs.OnUpdatedChangeInfoType
import Tab = Tabs.Tab
import { APP_NAME } from '@constant/defaults'

export function makeOnUpdateHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>) {
  return (tabId: number, changeInfo: OnUpdatedChangeInfoType, tab: Tab) => {
    if (!changeInfo.url) return

    for (const proxyId in config.keepAliveRules) {
      const rule = config.keepAliveRules[proxyId]
      if (!rule.active) continue

      // Remove tab from previous patterns
      trackTabForKeepAlive(tabId, tab.url, proxyId, rule, false, keepAliveStates)

      // Add tab to new pattern if it's not discarded
      trackTabForKeepAlive(tabId, changeInfo.url, proxyId, rule, !tab.discarded, keepAliveStates)

      const proxy = resolveProxy(config, proxyId)
      if (proxy) {
        maybeUpdateProxyKeepAlive(proxy, keepAliveStates[proxyId])
      }
    }
  }
}

export function makeOnActiveHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>) {
  return async (activeInfo: Tabs.OnActivatedActiveInfoType) => {
    const tab = await browser.tabs.get(activeInfo.tabId)
    for (const proxyId in config.keepAliveRules) {
      const rule = config.keepAliveRules[proxyId]
      if (!rule.active) continue

      trackTabForKeepAlive(activeInfo.tabId, tab.url, proxyId, rule, !tab.discarded, keepAliveStates)

      const proxy = resolveProxy(config, proxyId)
      if (proxy) {
        maybeUpdateProxyKeepAlive(proxy, keepAliveStates[proxyId])
      }
    }
  }
}

export function makeOnRemovedHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>) {
  return (tabId: number) => {
    for (const proxyId in config.keepAliveRules) {
      const rule = config.keepAliveRules[proxyId]
      if (!rule.active) continue

      const state = keepAliveStates[proxyId]
      if (!state) continue
      for (const [pattern, set] of state.activeTabs.entries()) {
        set.delete(tabId)
        if (set.size === 0) state.activeTabs.delete(pattern)
      }
      const proxy = resolveProxy(config, proxyId)
      if (proxy) {
        maybeUpdateProxyKeepAlive(proxy, state)
      }
    }
  }
}

function trackTabForKeepAlive (
  tabId: number,
  url: string | undefined,
  proxyId: string,
  rule: { tabUrls: string[]; testProxyUrl?: string },
  add: boolean,
  keepAliveStates: Record<string, KeepAliveState>,
) {
  if (!url) return
  const hostname = getHostname(url)
  if (!hostname) return
  const state = keepAliveStates[proxyId]
  if (!state) return

  for (let i = 0; i < rule.tabUrls.length; ++i) {
    const pattern = rule.tabUrls[i]
    if (matchHostname(hostname, pattern)) {
      if (add) {
        if (!state.activeTabs.has(pattern)) {
          state.activeTabs.set(pattern, new Set())
        }
        state.activeTabs.get(pattern)!.add(tabId)
        // Optionally update the testUrl for this proxyId (depends on your design)
        state.testUrl = rule.testProxyUrl || state.testUrl
      } else {
        if (state.activeTabs.has(pattern)) {
          state.activeTabs.get(pattern)!.delete(tabId)
          if (state.activeTabs.get(pattern)!.size === 0) {
            state.activeTabs.delete(pattern)
          }
        }
      }
    }
  }
}

export function maybeUpdateProxyKeepAlive (proxy: ProxyListItem, state: KeepAliveState) {
  const shouldKeepAlive = Array.from(state.activeTabs.values()).some(set => set.size > 0)
  if (shouldKeepAlive && !state.interval) {
    state.interval = setInterval(() => keepAliveProxyStatus(proxy, state.testUrl), 15000)
    keepAliveProxyStatus(proxy, state.testUrl)
  } else if (!shouldKeepAlive && state.interval) {
    clearInterval(state.interval)
    state.interval = null
  }
}

export async function keepAliveProxyStatus (proxy: ProxyListRuntimeItem, testUrl: string) {
  testProxyConfigQueued(proxy, testUrl, (result) => {
    if (result.success) {
      console.debug(`[KeepAlive] Proxy ${proxy.host}:${proxy.port} is alive.`)
      proxy.downNotification = 0
    } else {
      console.warn(`[KeepAlive] Proxy ${proxy.host}:${proxy.port} failed: ${result.error}`)
      if (proxy.notifyIfDown) {
        if ((proxy.downNotification || 0) < 4) {
          browser.notifications.create('proxy-error', {
            type: 'basic',
            title: `${APP_NAME} keep alive encountered an error!`,
            message: `Proxy ${proxy.host}:${proxy.port} failed: ${result.error || 'Unknown error'}`,
          })
          if (!proxy.downNotification) {
            proxy.downNotification = 0
          }
          proxy.downNotification++
        }
      }
    }
  })
}
