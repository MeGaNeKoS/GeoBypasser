import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { resolveProxy } from '@utils/proxy'
import type { Tabs } from 'webextension-polyfill'
import { getHostname, KeepAliveState, matchHostname } from '@utils/generic'
import { usableKeepAliveRules } from '@utils/usable'
import { ProxyListItem, ProxyTestResult } from '@customTypes/proxy'
import { APP_NAME } from '@constant/defaults'

type OnUpdatedChangeInfoType = Tabs.OnUpdatedChangeInfoType
type Tab = Tabs.Tab

export type KeepAliveTab = Pick<Tab, 'id' | 'url' | 'discarded'>

export type ProxyNotifications = {
  show: (id: string, title: string, message: string) => void;
  clear: (id: string) => void;
}

export type KeepAlivePorts = {
  listTabs: () => Promise<KeepAliveTab[]>;
  getTab: (tabId: number) => Promise<KeepAliveTab>;
  checkProxy: (proxy: ProxyListItem, testUrl: string, sendResult: (result: ProxyTestResult) => void) => void;
  notifications: ProxyNotifications;
}

export type KeepAliveTabListeners = {
  onUpdated: (tabId: number, changeInfo: OnUpdatedChangeInfoType, tab: Tab) => void;
  onActivated: (activeInfo: Tabs.OnActivatedActiveInfoType) => void;
  onRemoved: (tabId: number) => void;
}

export function createKeepAlive (ports: KeepAlivePorts) {
  const keepAliveStates: Record<string, KeepAliveState> = {}
  return {
    async restart (config: GeoBypassRuntimeSettings): Promise<KeepAliveTabListeners | undefined> {
      await initKeepAlive(config, keepAliveStates, ports)
      return keepAliveTabListeners(config, keepAliveStates, ports)
    },
  }
}

function keepAliveTabListeners (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>,
  ports: KeepAlivePorts,
): KeepAliveTabListeners | undefined {
  if (!config.keepAliveRules) return undefined
  return {
    onUpdated: makeOnUpdateHandler(config, keepAliveStates, ports),
    onActivated: makeOnActiveHandler(config, keepAliveStates, ports),
    onRemoved: makeOnRemovedHandler(config, keepAliveStates, ports),
  }
}

export function makeOnUpdateHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>,
  ports: KeepAlivePorts) {
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
        maybeUpdateProxyKeepAlive(proxy, keepAliveStates[proxyId], ports)
      }
    }
  }
}

export function makeOnActiveHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>,
  ports: KeepAlivePorts) {
  return async (activeInfo: Tabs.OnActivatedActiveInfoType) => {
    const tab = await ports.getTab(activeInfo.tabId)
    const keepAliveRules = usableKeepAliveRules(config.keepAliveRules)
    for (const proxyId in keepAliveRules) {
      const rule = keepAliveRules[proxyId]
      if (!rule.active) continue

      trackTabForKeepAlive(activeInfo.tabId, tab.url, proxyId, rule, !tab.discarded, keepAliveStates)

      const proxy = resolveProxy(config, proxyId)
      if (proxy) {
        maybeUpdateProxyKeepAlive(proxy, keepAliveStates[proxyId], ports)
      }
    }
  }
}

export function makeOnRemovedHandler (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>,
  ports: KeepAlivePorts) {
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
        maybeUpdateProxyKeepAlive(proxy, state, ports)
      }
    }
  }
}

async function initKeepAlive (
  config: GeoBypassRuntimeSettings,
  keepAliveStates: Record<string, KeepAliveState>,
  ports: KeepAlivePorts,
) {
  console.info(`[${APP_NAME}BG] Initializing keep-alive for proxies.`)
  if (!config.keepAliveRules || typeof config.keepAliveRules !== 'object') {
    console.info(`[${APP_NAME}BG] No keepAliveRules found in config, skipping keep-alive setup.`)
    return
  }

  Object.values(keepAliveStates).forEach(state => {
    if (state.timer) {
      clearTimeout(state.timer)
      console.debug(`[${APP_NAME}BG] Cleared previous keep-alive timer for a proxy.`)
    }
  })

  // Reset keepAliveStates
  Object.keys(keepAliveStates).forEach(key => {
    delete keepAliveStates[key]
    console.debug(`[${APP_NAME}BG] Removed keepAliveState for proxy: ${key}`)
  })

  const keepAliveRules = usableKeepAliveRules(config.keepAliveRules)

  // Group keepAliveStates by proxyId
  for (const proxyId in keepAliveRules) {
    const rule = keepAliveRules[proxyId]
    if (!rule.active) {
      console.info(`[${APP_NAME}BG] Keep-alive rule for proxyId ${proxyId} is inactive, skipping.`)
      continue
    }
    keepAliveStates[proxyId] = {
      activeTabs: new Map(),
      timer: null,
      testUrl: config.testProxyUrl,
      consecutiveFailures: 0,
      reportedDown: false,
    }
    console.debug(`[${APP_NAME}BG] Initialized keepAliveState for proxyId ${proxyId}`)
  }

  const tabs = await ports.listTabs()
  console.info(`[${APP_NAME}BG] Found ${tabs.length} open tabs while initializing keep-alive.`)

  for (const tab of tabs) {
    if (tab.discarded || !tab.url) {
      continue
    }
    const hostname = getHostname(tab.url)
    if (!hostname) {
      console.debug(`[${APP_NAME}BG] Could not extract hostname from tab url: ${tab.url}`)
      continue
    }

    for (const proxyId in keepAliveRules) {
      const rule = keepAliveRules[proxyId]
      if (!rule.active) continue

      for (const pattern of rule.tabUrls) {

        if (tab.id && matchHostname(hostname, pattern)) {
          const state = keepAliveStates[proxyId]
          if (!state.activeTabs.has(pattern)) {
            state.activeTabs.set(pattern, new Set())
          }
          state.activeTabs.get(pattern)!.add(tab.id)
          state.testUrl = rule.testProxyUrl || config.testProxyUrl
          console.debug(
            `[${APP_NAME}BG] Tab ${tab.id} (${hostname}) matched pattern "${pattern}" for proxyId ${proxyId}`)
        }
      }
    }
  }

  // Start keep-alive as needed
  for (const proxyId in keepAliveStates) {
    const rule = keepAliveStates[proxyId]
    const proxy = resolveProxy(config, proxyId)
    if (proxy) {
      console.debug(`[${APP_NAME}BG] Starting keep-alive for proxyId [${proxy.label}]`)
      maybeUpdateProxyKeepAlive(proxy, rule, ports)
    } else {
      console.warn(
        `[${APP_NAME}BG] Could not resolve proxy config for proxyId ${proxyId}, skipping keep-alive setup for this proxy.`)
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

export function maybeUpdateProxyKeepAlive (proxy: ProxyListItem, state: KeepAliveState, ports: KeepAlivePorts) {
  const shouldKeepAlive = hasActiveTabs(state)
  if (shouldKeepAlive && !state.timer) {
    scheduleNextCheck(proxy, state, KEEP_ALIVE_START_DELAY_MS, ports)
  } else if (!shouldKeepAlive && state.timer) {
    stopKeepAlive(state)
  }
}

export function keepAliveProxyStatus (proxy: ProxyListItem, state: KeepAliveState, ports: KeepAlivePorts) {
  ports.checkProxy(proxy, state.testUrl, (result) => {
    logCheck(proxy, result)
    const notice = applyCheckResult(state, result.success)
    if (notice && proxy.notifyIfDown) notifyProxyChange(proxy, notice, ports.notifications)
    if (hasActiveTabs(state)) scheduleNextCheck(proxy, state, nextCheckDelayMs(state.consecutiveFailures), ports)
    else stopKeepAlive(state)
  })
}

function hasActiveTabs (state: KeepAliveState) {
  return Array.from(state.activeTabs.values()).some(set => set.size > 0)
}

function scheduleNextCheck (proxy: ProxyListItem, state: KeepAliveState, delayMs: number, ports: KeepAlivePorts) {
  if (state.timer) clearTimeout(state.timer)
  state.timer = setTimeout(() => keepAliveProxyStatus(proxy, state, ports), delayMs)
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

function notifyProxyChange (proxy: ProxyListItem, notice: KeepAliveNotice, notifications: ProxyNotifications) {
  if (notice === 'down') notifyProxyDown(proxy, notifications)
  else notifyProxyBack(proxy, notifications)
}

function notifyProxyDown (proxy: ProxyListItem, notifications: ProxyNotifications) {
  notifications.show(
    proxyDownNotificationId(proxy),
    `${APP_NAME} proxy is down`,
    `${proxyDisplayName(proxy)} has failed ${DOWN_AFTER_FAILED_CHECKS} checks in a row.`,
  )
}

function notifyProxyBack (proxy: ProxyListItem, notifications: ProxyNotifications) {
  notifications.clear(proxyDownNotificationId(proxy))
  notifications.show(
    proxyBackNotificationId(proxy),
    `${APP_NAME} proxy is back`,
    `${proxyDisplayName(proxy)} is responding again.`,
  )
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
