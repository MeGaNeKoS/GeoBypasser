import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import browser, { Proxy, Tabs } from 'webextension-polyfill'

import { createProxyAuthListener } from '@core/proxyAuth'
import {
  makeDefaultProxyHandler,
  makeDomainProxyHandler,
  makeProxyHandler,
  makeTabProxyHandler,
  resolveProxy,
} from '@utils/proxy'
import { getAllMatchUrls, getHostname, KeepAliveState, matchHostname } from '@utils/generic'
import { getConfig, getTabProxyMap, sanitizeSection, saveTabProxyMap } from '@utils/storage'
import { APP_NAME } from '@constant/defaults'
import { STORAGE_KEYS, TAB_PROXY_MAP } from '@constant/storageKeys'
import { makeOnActiveHandler, makeOnRemovedHandler, makeOnUpdateHandler, maybeUpdateProxyKeepAlive } from '@core/keepAlive'
import { isNetworkMessage, isTabProxyMessage } from '@utils/messages'
import { createNetworkMonitor } from '@core/networkMonitor'
import { registerFirefoxNetworkMonitor } from '@adapters/firefox'
import { usableKeepAliveRules } from '@utils/usable'
import OnUpdatedChangeInfoType = Tabs.OnUpdatedChangeInfoType
import Tab = Tabs.Tab

type currentProxyHandler = {
  tab?: (details: Proxy.OnRequestDetailsType) => void;
  domain?: (details: Proxy.OnRequestDetailsType) => void;
  main?: (details: Proxy.OnRequestDetailsType) => void;
  default?: (details: Proxy.OnRequestDetailsType) => void;
}
type currentKeepAliveHandler = {
  onUpdate?: (tabId: number, changeInfo: OnUpdatedChangeInfoType, tab: Tab) => void;
  onActivated?: (activeInfo: Tabs.OnActivatedActiveInfoType) => void;
  onRemoved?: (tabId: number) => void;
}

const keepAliveStates: Record<string, KeepAliveState> = {}
const tabProxyMap: Record<number, string> = {}
const networkMonitor = createNetworkMonitor()

function attachProxyHandlers (
  config: GeoBypassRuntimeSettings,
  currentHandlers: currentProxyHandler,
  changedKeys: string[] = [],
) {
  (['tab', 'domain', 'main', 'default'] as const).forEach(type => {
    const handler = currentHandlers[type]
    if (handler && browser.proxy.onRequest.hasListener(handler)) {
      browser.proxy.onRequest.removeListener(handler)
    }
  })

  const urls = getAllMatchUrls(config)

  if (!currentHandlers.tab) {
    currentHandlers.tab = makeTabProxyHandler(config, tabProxyMap)
  }

  if (!currentHandlers.domain) {
    currentHandlers.domain = makeDomainProxyHandler(config)
  }

  if (!currentHandlers.main || changedKeys.includes('rules')) {
    if (urls.length > 0) {
      currentHandlers.main = makeProxyHandler(config)
    } else {
      currentHandlers.main = undefined
    }
  }
  if (changedKeys.includes('defaultProxy')) {
    currentHandlers.default = config.defaultProxy
      ? makeDefaultProxyHandler(config)
      : undefined
  } else if (!currentHandlers.default && config.defaultProxy) {
    currentHandlers.default = makeDefaultProxyHandler(config)
  }

  if (currentHandlers.tab) {
    browser.proxy.onRequest.addListener(currentHandlers.tab, { urls: ['<all_urls>'] })
  }
  if (currentHandlers.domain) {
    browser.proxy.onRequest.addListener(currentHandlers.domain, { urls: ['<all_urls>'] })
  }
  if (currentHandlers.main) {
    browser.proxy.onRequest.addListener(currentHandlers.main, { urls })
  }
  if (currentHandlers.default) {
    browser.proxy.onRequest.addListener(currentHandlers.default, { urls: ['<all_urls>'] })
  }
}

async function initKeepAlive (config: GeoBypassRuntimeSettings) {
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

  const tabs = await browser.tabs.query({})
  console.info(`[${APP_NAME}BG] Found ${tabs.length} open tabs while initializing keep-alive.`)

  for (const tab of tabs) {
    if (tab.discarded || !tab.url) {
      // console.debug(`[${APP_NAME}BG] Skipping discarded or missing-url tab: ${tab.id}`)
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
      maybeUpdateProxyKeepAlive(proxy, rule)
    } else {
      console.warn(
        `[${APP_NAME}BG] Could not resolve proxy config for proxyId ${proxyId}, skipping keep-alive setup for this proxy.`)
    }
  }
}

function setupKeepAliveListeners (config: GeoBypassRuntimeSettings, currentHandlers: currentKeepAliveHandler) {
  console.info(`[${APP_NAME}BG] Setting up keep-alive listeners...`)
  if (currentHandlers.onUpdate) {
    browser.tabs.onUpdated.removeListener(currentHandlers.onUpdate)
    console.debug(`[${APP_NAME}BG] Removed old tabs.onUpdated listener.`)
  }
  if (currentHandlers.onActivated) {
    browser.tabs.onActivated.removeListener(currentHandlers.onActivated)
    console.debug(`[${APP_NAME}BG] Removed old tabs.onActivated listener.`)
  }
  if (currentHandlers.onRemoved) {
    browser.tabs.onRemoved.removeListener(currentHandlers.onRemoved)
    console.debug(`[${APP_NAME}BG] Removed old tabs.onRemoved listener.`)
  }
  if (!config.keepAliveRules) {
    console.info(`[${APP_NAME}BG] No keepAliveRules in config, skipping keep-alive listeners setup.`)
    return
  }
  const onUpdateCallback = makeOnUpdateHandler(config, keepAliveStates)
  browser.tabs.onUpdated.addListener(onUpdateCallback)
  const onActivatedCallback = makeOnActiveHandler(config, keepAliveStates)
  browser.tabs.onActivated.addListener(onActivatedCallback)
  currentHandlers.onUpdate = onUpdateCallback
  const onRemovedCallback = makeOnRemovedHandler(config, keepAliveStates)
  browser.tabs.onRemoved.addListener(onRemovedCallback)
  currentHandlers.onRemoved = onRemovedCallback
  console.info(`[${APP_NAME}BG] Keep-alive listeners set up.`)
}

(async () => {
  const handlers: currentProxyHandler = {}
  const keepAliveHandlers: currentKeepAliveHandler = {}

  console.info(`[${APP_NAME}BG] Loading initial config...`)
  const config = await getConfig()
  console.info(`[${APP_NAME}BG] Loaded initial config.`)

  Object.assign(tabProxyMap, await getTabProxyMap())
  if (Object.keys(tabProxyMap).length) {
    console.info(`[${APP_NAME}BG] Loaded tab proxy mappings from storage.`)
  }

  browser.webRequest.onAuthRequired.addListener(
    createProxyAuthListener(() => config.proxyList),
    { urls: ['<all_urls>'] },
    ['blocking'],
  )
  attachProxyHandlers(config, handlers)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  await initKeepAlive(config)
  setupKeepAliveListeners(config, keepAliveHandlers)

  registerFirefoxNetworkMonitor(networkMonitor)

  browser.runtime.onMessage.addListener(async (message: unknown) => {
    if (isTabProxyMessage(message)) {
      if (message.type === 'setTabProxy') {
        tabProxyMap[message.tabId] = message.proxyId
        saveTabProxyMap(tabProxyMap)
      } else if (message.type === 'clearTabProxy') {
        delete tabProxyMap[message.tabId]
        saveTabProxyMap(tabProxyMap)
      }
      return
    }

    if (isNetworkMessage(message)) return networkMonitor.answerNetworkMessage(message)
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    if (tabProxyMap[tabId]) {
      delete tabProxyMap[tabId]
      console.debug(`[${APP_NAME}BG] Removed tabProxyMap entry for closed tab ${tabId}`)
      saveTabProxyMap(tabProxyMap)
    }
    networkMonitor.forgetTab(tabId)
  })

  // Error listener
  browser.proxy.onError.addListener((error: Proxy.OnErrorErrorType) => {
    console.error(`[${APP_NAME}BG] Proxy error occurred:`, error?.message)
  })

  // Storage listener for live config updates
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    console.info(`[${APP_NAME}BG] Storage change detected. Area: ${areaName}. Keys: ${Object.keys(changes).join(', ')}.`)

    if (areaName === 'local' && changes[TAB_PROXY_MAP]) {
      const newMap = changes[TAB_PROXY_MAP].newValue as Record<number, string> || {}
      Object.keys(tabProxyMap).forEach(k => delete tabProxyMap[Number(k)])
      Object.assign(tabProxyMap, newMap)
      console.info(`[${APP_NAME}BG] tabProxyMap updated from storage.`)
    }

    if (areaName !== 'local') return

    const changedKeys: string[] = []
    if (changes[STORAGE_KEYS.proxyList]) {
      config.proxyList = sanitizeSection(STORAGE_KEYS.proxyList, changes[STORAGE_KEYS.proxyList].newValue)
      changedKeys.push('proxyList')
    }
    if (changes[STORAGE_KEYS.defaultProxy]) {
      config.defaultProxy = sanitizeSection(STORAGE_KEYS.defaultProxy, changes[STORAGE_KEYS.defaultProxy].newValue)
      changedKeys.push('defaultProxy')
    }
    if (changes[STORAGE_KEYS.fallbackDirect]) {
      config.fallbackDirect = sanitizeSection(STORAGE_KEYS.fallbackDirect, changes[STORAGE_KEYS.fallbackDirect].newValue)
      changedKeys.push('fallbackDirect')
    }
    if (changes[STORAGE_KEYS.testProxyUrl]) {
      config.testProxyUrl = sanitizeSection(STORAGE_KEYS.testProxyUrl, changes[STORAGE_KEYS.testProxyUrl].newValue)
      changedKeys.push('testProxyUrl')
    }
    if (changes[STORAGE_KEYS.rules]) {
      config.rules = sanitizeSection(STORAGE_KEYS.rules, changes[STORAGE_KEYS.rules].newValue)
      changedKeys.push('rules')
    }
    if (changes[STORAGE_KEYS.keepAliveRules]) {
      config.keepAliveRules = sanitizeSection(STORAGE_KEYS.keepAliveRules, changes[STORAGE_KEYS.keepAliveRules].newValue)
      changedKeys.push('keepAliveRules')
    }
    if (changes[STORAGE_KEYS.perWebsiteOverride]) {
      config.perWebsiteOverride = sanitizeSection(
        STORAGE_KEYS.perWebsiteOverride,
        changes[STORAGE_KEYS.perWebsiteOverride].newValue,
      )
      changedKeys.push('perWebsiteOverride')
    }

    if (changedKeys.length) {
      attachProxyHandlers(config, handlers, changedKeys)
      if (changedKeys.includes('keepAliveRules') || changedKeys.includes('testProxyUrl')) {
        await initKeepAlive(config)
        setupKeepAliveListeners(config, keepAliveHandlers)
      }
      console.info(`[${APP_NAME}BG] Handlers updated after config change.`)
    }
  })

  console.info(`[${APP_NAME}BG] Proxy extension background script initialized and running.`)
})()
