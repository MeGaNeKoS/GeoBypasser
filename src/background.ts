import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import browser, { Proxy, Tabs, WebRequest } from 'webextension-polyfill'

import {
  getProxyTypeByChallenger,
  makeDefaultProxyHandler,
  makeDomainProxyHandler,
  makeProxyHandler,
  makeTabProxyHandler,
  resolveProxy,
} from '@utils/proxy'
import { getAllMatchUrls, getHostname, KeepAliveState, matchHostname } from '@utils/generic'
import { compileRules, getConfig, getUserStorageMode, getTabProxyMap, saveTabProxyMap } from '@utils/storage'
import { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { APP_NAME } from '@constant/defaults'
import { STORAGE_KEYS, TAB_PROXY_MAP } from '@constant/storageKeys'
import { makeOnActiveHandler, makeOnRemovedHandler, makeOnUpdateHandler, maybeUpdateProxyKeepAlive } from '@utils/tab'
import { isTabProxyMessage, isNetworkMessage } from '@utils/messages'
import { addNetworkData, networkStats, resetNetworkStats } from '@utils/network'
import OnAuthRequiredDetailsType = WebRequest.OnAuthRequiredDetailsType
import BlockingResponseOrPromiseOrVoid = WebRequest.BlockingResponseOrPromiseOrVoid
import OnUpdatedChangeInfoType = Tabs.OnUpdatedChangeInfoType
import Tab = Tabs.Tab

type currentProxyHandler = {
  tab?: (details: Proxy.OnRequestDetailsType) => void;
  domain?: (details: Proxy.OnRequestDetailsType) => void;
  main?: (details: Proxy.OnRequestDetailsType) => void;
  default?: (details: Proxy.OnRequestDetailsType) => void;
  oauthRequired?: (details: OnAuthRequiredDetailsType) => BlockingResponseOrPromiseOrVoid;
}
type currentKeepAliveHandler = {
  onUpdate?: (tabId: number, changeInfo: OnUpdatedChangeInfoType, tab: Tab) => void;
  onActivated?: (activeInfo: Tabs.OnActivatedActiveInfoType) => void;
  onRemoved?: (tabId: number) => void;
}

const keepAliveStates: Record<string, KeepAliveState> = {}
const tabProxyMap: Record<number, string> = {}
const requestSizes = new Map<string | number, number>()
const monitoredTabs = new Set<number>()

function attachProxyHandlers (
  config: GeoBypassRuntimeSettings,
  currentHandlers: currentProxyHandler,
  changedKeys: string[] = [],
) {
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
      currentHandlers.oauthRequired = createAuthRequiredHandler(config.proxyList)
    } else {
      currentHandlers.main = undefined
      currentHandlers.oauthRequired = undefined
    }
  }

  if (changedKeys.includes('defaultProxy')) {
    currentHandlers.default = config.defaultProxy
      ? makeDefaultProxyHandler(config)
      : undefined
  } else if (!currentHandlers.default && config.defaultProxy) {
    currentHandlers.default = makeDefaultProxyHandler(config)
  }

  (['tab', 'domain', 'main', 'default'] as const).forEach(type => {
    const handler = currentHandlers[type]
    if (handler && browser.proxy.onRequest.hasListener(handler)) {
      browser.proxy.onRequest.removeListener(handler)
    }
  })

  if (currentHandlers.oauthRequired && browser.webRequest.onAuthRequired.hasListener(currentHandlers.oauthRequired)) {
    browser.webRequest.onAuthRequired.removeListener(currentHandlers.oauthRequired)
  }

  if (currentHandlers.tab) {
    browser.proxy.onRequest.addListener(currentHandlers.tab, { urls: ['<all_urls>'] })
  }
  if (currentHandlers.domain) {
    browser.proxy.onRequest.addListener(currentHandlers.domain, { urls: ['<all_urls>'] })
  }
  if (currentHandlers.main) {
    browser.proxy.onRequest.addListener(currentHandlers.main, { urls })
    if (currentHandlers.oauthRequired) {
      browser.webRequest.onAuthRequired.addListener(
        currentHandlers.oauthRequired,
        { urls: ['<all_urls>'] },
        ['asyncBlocking'],
      )
    }
  }
  if (currentHandlers.default) {
    browser.proxy.onRequest.addListener(currentHandlers.default, { urls: ['<all_urls>'] })
  }
}

function createAuthRequiredHandler (proxyList: ProxyListItem[]) {
  return async function (details: OnAuthRequiredDetailsType) {
    console.debug(`[${APP_NAME}BG] Auth required detected:`, details)

    const proxy = getProxyTypeByChallenger(
      details.challenger.host,
      details.challenger.port,
      proxyList,
    )
    if (proxy) {
      console.debug(
        `[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - providing credentials (username: ${proxy.username}).`)
      return {
        authCredentials: {
          username: proxy.username || '',
          password: proxy.password || '',
        },
      }
    }
    console.debug(
      `[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - no credentials found in proxy list.`)
    return {}
  }
}

async function initKeepAlive (config: GeoBypassRuntimeSettings) {
  console.info(`[${APP_NAME}BG] Initializing keep-alive for proxies.`)
  if (!config.keepAliveRules || typeof config.keepAliveRules !== 'object') {
    console.info(`[${APP_NAME}BG] No keepAliveRules found in config, skipping keep-alive setup.`)
    return
  }

  // Clean up old intervals
  Object.values(keepAliveStates).forEach(state => {
    if (state.interval) {
      clearInterval(state.interval)
      console.debug(`[${APP_NAME}BG] Cleared previous keep-alive interval for a proxy.`)
    }
  })

  // Reset keepAliveStates
  Object.keys(keepAliveStates).forEach(key => {
    delete keepAliveStates[key]
    console.debug(`[${APP_NAME}BG] Removed keepAliveState for proxy: ${key}`)
  })

  // Group keepAliveStates by proxyId
  for (const proxyId in config.keepAliveRules) {
    const rule = config.keepAliveRules[proxyId]
    if (!rule.active) {
      console.info(`[${APP_NAME}BG] Keep-alive rule for proxyId ${proxyId} is inactive, skipping.`)
      continue
    }
    keepAliveStates[proxyId] = { activeTabs: new Map(), interval: null, testUrl: config.testProxyUrl }
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

    for (const proxyId in config.keepAliveRules) {
      const rule = config.keepAliveRules[proxyId]
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
      console.debug(`[${APP_NAME}BG] Starting keep-alive for proxyId ${proxyId}`)
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
  console.info(`[${APP_NAME}BG] Loaded initial config:`, config)

  Object.assign(tabProxyMap, await getTabProxyMap())
  if (Object.keys(tabProxyMap).length) {
    console.info(`[${APP_NAME}BG] Loaded tab proxy mappings from storage.`)
  }

  attachProxyHandlers(config, handlers)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  await initKeepAlive(config)
  setupKeepAliveListeners(config, keepAliveHandlers)

  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      if (!monitoredTabs.has(details.tabId)) return
      const h = details.requestHeaders?.find(h => h.name.toLowerCase() === 'content-length')
      if (h) {
        const size = Number(h.value) || 0
        requestSizes.set(details.requestId, size)
      }
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders']
  )
  browser.webRequest.onCompleted.addListener(
    details => {
      if (!monitoredTabs.has(details.tabId)) return
      const sent = requestSizes.get(details.requestId) || 0
      requestSizes.delete(details.requestId)
      let received = 0
      const h = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-length')
      if (h) received = Number(h.value) || 0
      addNetworkData(details.url, sent, received)
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
  )
  browser.webRequest.onErrorOccurred.addListener(
    details => {
      if (monitoredTabs.has(details.tabId)) requestSizes.delete(details.requestId)
    },
    { urls: ['<all_urls>'] }
  )

  browser.runtime.onMessage.addListener(async (message: any) => {
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

    if (isNetworkMessage(message)) {
      if (message.type === 'getNetworkStats') return networkStats
      if (message.type === 'clearNetworkStats') { resetNetworkStats(); return }
      if (message.type === 'monitorTabNetwork') { monitoredTabs.add(message.tabId); return }
      if (message.type === 'unmonitorTabNetwork') { monitoredTabs.delete(message.tabId); return }
      if (message.type === 'isTabNetworkMonitored') return monitoredTabs.has(message.tabId)
    }
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    if (tabProxyMap[tabId]) {
      delete tabProxyMap[tabId]
      console.debug(`[${APP_NAME}BG] Removed tabProxyMap entry for closed tab ${tabId}`)
      saveTabProxyMap(tabProxyMap)
    }
    monitoredTabs.delete(tabId)
  })

  // Error listener
  browser.proxy.onError.addListener((error: Proxy.OnErrorErrorType) => {
    console.error(`[${APP_NAME}BG] Proxy error occurred:`, error?.message)
    console.dir(error)
    browser.notifications.create('proxy-error', {
      type: 'basic',
      title: 'GeoBypass-er encountered an error!',
      message: error.message as string || 'An unknown error occurred.',
    })
  })

  // Storage listener for live config updates
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    console.info(`[${APP_NAME}BG] Storage change detected. Area: ${areaName}. Changes:`, changes)

    if (areaName === 'local' && changes.storageMode) {
      console.info(`[${APP_NAME}BG] Detected storageMode change, reloading config...`)
      const newConfig = await getConfig()
      Object.assign(config, newConfig)
      attachProxyHandlers(config, handlers, ['rules', 'defaultProxy'])
      await initKeepAlive(config)
      setupKeepAliveListeners(config, keepAliveHandlers)
      console.info(`[${APP_NAME}BG] Handlers updated after storageMode switch.`)
      return
    }

    if (areaName === 'local' && changes[TAB_PROXY_MAP]) {
      const newMap = changes[TAB_PROXY_MAP].newValue as Record<number, string> || {}
      Object.keys(tabProxyMap).forEach(k => delete tabProxyMap[Number(k)])
      Object.assign(tabProxyMap, newMap)
      console.info(`[${APP_NAME}BG] tabProxyMap updated from storage.`)
    }

    const currentStorageMode = await getUserStorageMode()
    const currentArea = currentStorageMode === 'cloud' ? 'sync' : 'local'
    if (areaName !== currentArea) return

    const changedKeys: string[] = []
    if (changes[STORAGE_KEYS.proxyList]) {
      config.proxyList = changes[STORAGE_KEYS.proxyList].newValue as ProxyListItem[]
      changedKeys.push('proxyList')
    }
    if (changes[STORAGE_KEYS.defaultProxy]) {
      config.defaultProxy = changes[STORAGE_KEYS.defaultProxy].newValue as string | undefined
      changedKeys.push('defaultProxy')
    }
    if (changes[STORAGE_KEYS.fallbackDirect]) {
      config.fallbackDirect = changes[STORAGE_KEYS.fallbackDirect].newValue as boolean | undefined
      changedKeys.push('fallbackDirect')
    }
    if (changes[STORAGE_KEYS.testProxyUrl]) {
      config.testProxyUrl = changes[STORAGE_KEYS.testProxyUrl].newValue as string
      changedKeys.push('testProxyUrl')
    }
    if (changes[STORAGE_KEYS.rules]) {
      config.rules = compileRules(changes[STORAGE_KEYS.rules].newValue as ProxyRule[])
      changedKeys.push('rules')
    }
    if (changes[STORAGE_KEYS.keepAliveRules]) {
      config.keepAliveRules = changes[STORAGE_KEYS.keepAliveRules].newValue as Record<string, {
        active: boolean;
        tabUrls: string[];
        testProxyUrl?: string;
      }>
      changedKeys.push('keepAliveRules')
    }
    if (changes[STORAGE_KEYS.perWebsiteOverride]) {
      config.perWebsiteOverride = changes[STORAGE_KEYS.perWebsiteOverride].newValue as Record<string, string>
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
