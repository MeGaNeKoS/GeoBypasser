import browser, { Proxy } from 'webextension-polyfill'

import { createProxyAuthListener } from '@core/proxyAuth'
import { getConfig, getTabProxyMap, sanitizeSection } from '@utils/storage'
import { APP_NAME } from '@constant/defaults'
import { STORAGE_KEYS, TAB_PROXY_MAP } from '@constant/storageKeys'
import { createKeepAlive } from '@core/keepAlive'
import { isNetworkMessage, isTabProxyMessage } from '@utils/messages'
import { createNetworkMonitor } from '@core/networkMonitor'
import { createRouting } from '@core/routing'
import {
  firefoxKeepAlivePorts,
  firefoxRoutingPorts,
  registerFirefoxNetworkMonitor,
  setFirefoxKeepAliveListeners,
} from '@adapters/firefox'

const networkMonitor = createNetworkMonitor()
const routing = createRouting(firefoxRoutingPorts())
const keepAlive = createKeepAlive(firefoxKeepAlivePorts())

void (async () => {
  console.info(`[${APP_NAME}BG] Loading initial config...`)
  const config = await getConfig()
  console.info(`[${APP_NAME}BG] Loaded initial config.`)

  routing.replaceTabProxyMap(await getTabProxyMap())
  if (routing.tabProxyCount()) {
    console.info(`[${APP_NAME}BG] Loaded tab proxy mappings from storage.`)
  }

  browser.webRequest.onAuthRequired.addListener(
    createProxyAuthListener(() => config.proxyList),
    { urls: ['<all_urls>'] },
    ['blocking'],
  )
  routing.attach(config)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  setFirefoxKeepAliveListeners(await keepAlive.restart(config))

  registerFirefoxNetworkMonitor(networkMonitor)

  browser.runtime.onMessage.addListener(async (message: unknown) => {
    if (isTabProxyMessage(message)) {
      if (message.type === 'setTabProxy') {
        routing.setTabProxy(message.tabId, message.proxyId)
      } else if (message.type === 'clearTabProxy') {
        routing.clearTabProxy(message.tabId)
      }
      return
    }

    if (isNetworkMessage(message)) return networkMonitor.answerNetworkMessage(message)
  })

  browser.tabs.onRemoved.addListener((tabId) => {
    routing.forgetTab(tabId)
    networkMonitor.forgetTab(tabId)
  })

  browser.proxy.onError.addListener((error: Proxy.OnErrorErrorType) => {
    console.error(`[${APP_NAME}BG] Proxy error occurred:`, error?.message)
  })

  browser.storage.onChanged.addListener(async (changes, areaName) => {
    console.info(`[${APP_NAME}BG] Storage change detected. Area: ${areaName}. Keys: ${Object.keys(changes).join(', ')}.`)

    if (areaName === 'local' && changes[TAB_PROXY_MAP]) {
      const newMap = changes[TAB_PROXY_MAP].newValue as Record<number, string> || {}
      routing.replaceTabProxyMap(newMap)
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
      routing.attach(config, changedKeys)
      if (changedKeys.includes('keepAliveRules') || changedKeys.includes('testProxyUrl')) {
        setFirefoxKeepAliveListeners(await keepAlive.restart(config))
      }
      console.info(`[${APP_NAME}BG] Handlers updated after config change.`)
    }
  })

  console.info(`[${APP_NAME}BG] Proxy extension background script initialized and running.`)
})()
