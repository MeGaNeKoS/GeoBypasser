import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import browser, { Proxy, Tabs, WebRequest } from 'webextension-polyfill'

import { getProxyTypeByChallenger, makeDefaultProxyHandler, makeProxyHandler, resolveProxy } from '@utils/proxy'
import { getAllMatchUrls, getHostname, KeepAliveState, matchHostname } from '@utils/generic'
import { getConfig, getUserStorageMode } from '@utils/storage'
import { ProxyListItem } from '@customTypes/proxy'
import { APP_NAME } from '@constant/defaults'
import { makeOnActiveHandler, makeOnRemovedHandler, makeOnUpdateHandler, maybeUpdateProxyKeepAlive } from '@utils/tab'
import { isTabProxyMessage } from '@utils/messages'
import OnAuthRequiredDetailsType = WebRequest.OnAuthRequiredDetailsType
import BlockingResponseOrPromiseOrVoid = WebRequest.BlockingResponseOrPromiseOrVoid
import OnUpdatedChangeInfoType = Tabs.OnUpdatedChangeInfoType
import Tab = Tabs.Tab

type currentProxyHandler = {
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

function attachProxyHandlers (
  config: GeoBypassRuntimeSettings,
  currentHandlers: currentProxyHandler,
) {
  console.debug(`[${APP_NAME}BG] attachProxyHandlers called with config:`, config)

  if (currentHandlers.main) {
    browser.proxy.onRequest.removeListener(currentHandlers.main)
    console.debug(`[${APP_NAME}BG] Removed old main proxy handler.`)
  } else {
    console.debug(`[${APP_NAME}BG] No previous main proxy handler to remove.`)
  }
  if (currentHandlers.default) {
    browser.proxy.onRequest.removeListener(currentHandlers.default)
    console.debug(`[${APP_NAME}BG] Removed old default proxy handler.`)
  } else {
    console.debug(`[${APP_NAME}BG] No previous default proxy handler to remove.`)
  }
  if (currentHandlers.oauthRequired) {
    browser.webRequest.onAuthRequired.removeListener(currentHandlers.oauthRequired)
    console.debug(`[${APP_NAME}BG] Removed old auth required handler.`)
  } else {
    console.debug(`[${APP_NAME}BG] No previous auth required handler to remove.`)
  }

  const urls = getAllMatchUrls(config)
  console.info(`[${APP_NAME}BG] URL patterns for main proxy:`, urls)

  const mainHandler = makeProxyHandler(config, tabProxyMap)
  currentHandlers.main = mainHandler

  if (urls.length > 0) {
    browser.proxy.onRequest.addListener(mainHandler, { urls })
    console.info(`[${APP_NAME}BG] Registered main proxy handler for ${urls.length} URL patterns.`)

    const oauthHandler = createAuthRequiredHandler(config.proxyList)
    currentHandlers.oauthRequired = oauthHandler
    browser.webRequest.onAuthRequired.addListener(
      oauthHandler,
      { urls },
      ['asyncBlocking'],
    )
    console.info(`[${APP_NAME}BG] Registered webRequest.onAuthRequired handler for protected resources.`)
  } else {
    console.warn(`[${APP_NAME}BG] No URL patterns provided; main proxy handler not registered.`)
  }

  let defaultHandler
  if (config.defaultProxy) {
    defaultHandler = makeDefaultProxyHandler(config)
    currentHandlers.default = defaultHandler
    browser.proxy.onRequest.addListener(defaultHandler, { urls: ['<all_urls>'] })
    console.info(`[${APP_NAME}BG] Registered default proxy handler for <all_urls>.`)
  } else {
    console.info(`[${APP_NAME}BG] No default proxy specified; default proxy handler not registered.`)
  }

  return
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
  let config: GeoBypassRuntimeSettings
  const handlers: currentProxyHandler = {}
  const keepAliveHandlers: currentKeepAliveHandler = {}

  console.info(`[${APP_NAME}BG] Loading initial config...`)
  config = await getConfig()
  console.info(`[${APP_NAME}BG] Loaded initial config:`, config)

  attachProxyHandlers(config, handlers)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  await initKeepAlive(config)
  setupKeepAliveListeners(config, keepAliveHandlers)

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isTabProxyMessage(message)) return

    if (message.type === 'setTabProxy') {
      tabProxyMap[message.tabId] = message.proxyId
    } else if (message.type === 'clearTabProxy') {
      delete tabProxyMap[message.tabId]
    }
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
      config = await getConfig()
      attachProxyHandlers(config, handlers)

      await initKeepAlive(config)
      setupKeepAliveListeners(config, keepAliveHandlers)

      console.info(`[${APP_NAME}BG] Handlers updated after storageMode switch.`)
      return
    }

    const currentStorageMode = await getUserStorageMode()
    const currentArea = currentStorageMode === 'cloud' ? 'sync' : 'local'
    if (areaName === currentArea && changes.proxyExtensionConfig) {
      console.info(`[${APP_NAME}BG] Detected config change in "${areaName}", reloading config...`)
      config = await getConfig()
      attachProxyHandlers(config, handlers)

      await initKeepAlive(config)
      setupKeepAliveListeners(config, keepAliveHandlers)

      console.info(`[${APP_NAME}BG] Handlers updated after config change.`)
    }
  })

  console.info(`[${APP_NAME}BG] Proxy extension background script initialized and running.`)
})()

