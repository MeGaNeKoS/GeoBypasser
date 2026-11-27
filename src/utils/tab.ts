import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { resolveProxy, testProxyConfigQueued } from '@utils/proxy'
import browser, { Tabs } from 'webextension-polyfill'
import { getHostname, KeepAliveState, matchHostname } from '@utils/generic'
import { usableKeepAliveRules } from '@utils/usable'
import { ProxyListItem, ProxyTestResult } from '@customTypes/proxy'
import OnUpdatedChangeInfoType = Tabs.OnUpdatedChangeInfoType
import Tab = Tabs.Tab
import { APP_NAME } from '@constant/defaults'

export function makeOnUpdateHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>) {
  return (tabId: number, changeInfo: OnUpdatedChangeInfoType, tab: Tab) => {
    if (!changeInfo.url) return

    const keepAliveRules = usableKeepAliveRules(config.keepAliveRules)
    for (const proxyId in keepAliveRules) {
      const rule = keepAliveRules[proxyId]
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
    const keepAliveRules = usableKeepAliveRules(config.keepAliveRules)
    for (const proxyId in keepAliveRules) {
      const rule = keepAliveRules[proxyId]
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
    const keepAliveRules = usableKeepAliveRules(config.keepAliveRules)
    for (const proxyId in keepAliveRules) {
      const rule = keepAliveRules[proxyId]
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

const KEEP_ALIVE_HEALTHY_INTERVAL_MS = 15000
const KEEP_ALIVE_FAILED_RETRY_MS = 5000
const KEEP_ALIVE_START_DELAY_MS = 0
const DOWN_AFTER_FAILED_CHECKS = 3

type KeepAliveNotice = 'down' | 'back'

export function maybeUpdateProxyKeepAlive (proxy: ProxyListItem, state: KeepAliveState) {
  const shouldKeepAlive = hasActiveTabs(state)
  if (shouldKeepAlive && !state.timer) {
    scheduleNextCheck(proxy, state, KEEP_ALIVE_START_DELAY_MS)
  } else if (!shouldKeepAlive && state.timer) {
    stopKeepAlive(state)
  }
}

export function keepAliveProxyStatus (proxy: ProxyListItem, state: KeepAliveState) {
  testProxyConfigQueued(proxy, state.testUrl, (result) => {
    logCheck(proxy, result)
    const notice = applyCheckResult(state, result.success)
    if (notice && proxy.notifyIfDown) notifyProxyChange(proxy, notice)
    if (hasActiveTabs(state)) scheduleNextCheck(proxy, state, nextCheckDelayMs(state.consecutiveFailures))
    else stopKeepAlive(state)
  })
}

function hasActiveTabs (state: KeepAliveState) {
  return Array.from(state.activeTabs.values()).some(set => set.size > 0)
}

function scheduleNextCheck (proxy: ProxyListItem, state: KeepAliveState, delayMs: number) {
  if (state.timer) clearTimeout(state.timer)
  state.timer = setTimeout(() => keepAliveProxyStatus(proxy, state), delayMs)
}

function stopKeepAlive (state: KeepAliveState) {
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  state.consecutiveFailures = 0
  state.reportedDown = false
}

function nextCheckDelayMs (consecutiveFailures: number) {
  return consecutiveFailures > 0 ? KEEP_ALIVE_FAILED_RETRY_MS : KEEP_ALIVE_HEALTHY_INTERVAL_MS
}

function applyCheckResult (state: KeepAliveState, success: boolean): KeepAliveNotice | null {
  const notice = keepAliveNotice(state.consecutiveFailures, state.reportedDown, success)
  state.consecutiveFailures = success ? 0 : state.consecutiveFailures + 1
  if (notice === 'down') state.reportedDown = true
  if (notice === 'back') state.reportedDown = false
  return notice
}

function keepAliveNotice (
  consecutiveFailures: number,
  reportedDown: boolean,
  success: boolean,
): KeepAliveNotice | null {
  if (success) return reportedDown ? 'back' : null
  const failuresAfterCheck = consecutiveFailures + 1
  return !reportedDown && failuresAfterCheck >= DOWN_AFTER_FAILED_CHECKS ? 'down' : null
}

function logCheck (proxy: ProxyListItem, result: ProxyTestResult) {
  if (result.success) console.debug(`[KeepAlive] Proxy ${proxy.host}:${proxy.port} is alive.`)
  else console.warn(`[KeepAlive] Proxy ${proxy.host}:${proxy.port} failed: ${result.error}`)
}

function notifyProxyChange (proxy: ProxyListItem, notice: KeepAliveNotice) {
  if (notice === 'down') notifyProxyDown(proxy)
  else notifyProxyBack(proxy)
}

function notifyProxyDown (proxy: ProxyListItem) {
  createProxyNotification(
    proxyDownNotificationId(proxy),
    `${APP_NAME} proxy is down`,
    `${proxyDisplayName(proxy)} has failed ${DOWN_AFTER_FAILED_CHECKS} checks in a row.`,
  )
}

function notifyProxyBack (proxy: ProxyListItem) {
  browser.notifications.clear(proxyDownNotificationId(proxy))
  createProxyNotification(
    proxyBackNotificationId(proxy),
    `${APP_NAME} proxy is back`,
    `${proxyDisplayName(proxy)} is responding again.`,
  )
}

function createProxyNotification (id: string, title: string, message: string) {
  browser.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message })
}

function proxyDownNotificationId (proxy: ProxyListItem) {
  return `proxy-down-${proxy.id}`
}

function proxyBackNotificationId (proxy: ProxyListItem) {
  return `proxy-back-${proxy.id}`
}

function proxyDisplayName (proxy: ProxyListItem) {
  return proxy.label || `${proxy.host}:${proxy.port}`
}
