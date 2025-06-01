import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import browser, { Proxy, WebRequest } from 'webextension-polyfill'
import { getProxyTypeByChallenger, makeDefaultProxyHandler, makeProxyHandler } from '@utils/proxy'
import { getAllMatchUrls } from '@utils/generic'
import { getConfig, getUserStorageMode } from '@utils/storage'
import { ProxyListItem } from '@customTypes/proxy'
import OnAuthRequiredDetailsType = WebRequest.OnAuthRequiredDetailsType
import BlockingResponseOrPromiseOrVoid = WebRequest.BlockingResponseOrPromiseOrVoid
import { APP_NAME } from '@constant/defaults'

type currentProxyHandler = {
  main?: (details: Proxy.OnRequestDetailsType) => void;
  default?: (details: Proxy.OnRequestDetailsType) => void;
  oauthRequired?: (details: OnAuthRequiredDetailsType) => BlockingResponseOrPromiseOrVoid;
}

function attachProxyHandlers (
  config: GeoBypassRuntimeSettings,
  currentHandlers: currentProxyHandler,
): currentProxyHandler {
  if (currentHandlers.main) {
    browser.proxy.onRequest.removeListener(currentHandlers.main)
    console.debug(`[${APP_NAME}BG] Removed old main proxy handler.`)
  }
  if (currentHandlers.default) {
    browser.proxy.onRequest.removeListener(currentHandlers.default)
    console.debug(`[${APP_NAME}BG] Removed old default proxy handler.`)
  }
  if (currentHandlers.oauthRequired) {
    browser.webRequest.onAuthRequired.removeListener(currentHandlers.oauthRequired)
    console.debug(`[${APP_NAME}BG] Removed old auth required handler.`)
  }

  const urls = getAllMatchUrls(config)
  const mainHandler = makeProxyHandler(config)
  let oauthHandler = undefined

  if (urls.length > 0) {
    browser.proxy.onRequest.addListener(mainHandler, { urls })
    console.info(`[${APP_NAME}BG] Registered main proxy handler for ${urls.length} URL patterns.`)

    oauthHandler = createAuthRequiredHandler(config.proxyList)
    browser.webRequest.onAuthRequired.addListener(
      oauthHandler,
      { urls },
      ['asyncBlocking'],
    )
    console.info(`[${APP_NAME}BG] Registered webRequest.onAuthRequired handler.`)
  }

  let defaultHandler
  if (config.defaultProxy) {
    defaultHandler = makeDefaultProxyHandler(config)
    browser.proxy.onRequest.addListener(defaultHandler, { urls: ['<all_urls>'] })
    console.info(`[${APP_NAME}BG] Registered default proxy handler for <all_urls>.`)
  }

  return { main: mainHandler, default: defaultHandler, oauthRequired: oauthHandler }
}

function createAuthRequiredHandler (proxyList: ProxyListItem[]) {
  return async function (details: OnAuthRequiredDetailsType) {
    const proxy = getProxyTypeByChallenger(
      details.challenger.host,
      details.challenger.port,
      proxyList,
    )
    if (proxy) {
      console.debug(`[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - providing credentials.`)
      return {
        authCredentials: {
          username: proxy.username || '',
          password: proxy.password || '',
        },
      }
    }
    console.debug(`[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - no credentials found.`)
    return {}
  }
}

(async () => {
  let config: GeoBypassRuntimeSettings
  let handlers: currentProxyHandler = {}

  config = await getConfig()
  console.info(`[${APP_NAME}BG] Loaded initial config.`)

  handlers = attachProxyHandlers(config, handlers)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  // Error listener
  browser.proxy.onError.addListener((error: Proxy.OnErrorErrorType) => {
    console.error(`[${APP_NAME}BG] Proxy error:`, error?.message)
    console.dir(error)
    browser.notifications.create('proxy-error', {
      type: 'basic',
      title: 'GeoBypass-er encountered an error!',
      message: error.message as string || 'An unknown error occurred.',
    })
  })

  // Storage listener for live config updates
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.storageMode) {
      console.info(`[${APP_NAME}BG] Detected storageMode change, reloading config...`)
      config = await getConfig()
      handlers = attachProxyHandlers(config, handlers)
      console.info(`[${APP_NAME}BG] Handlers updated after storageMode switch.`)
      return
    }

    const currentStorageMode = await getUserStorageMode()
    const currentArea = currentStorageMode === 'cloud' ? 'sync' : 'local'
    if (areaName === currentArea && changes.proxyExtensionConfig) {
      console.info(`[${APP_NAME}BG] Detected config change in "${areaName}", reloading config...`)
      config = await getConfig()
      handlers = attachProxyHandlers(config, handlers)
      console.info(`[${APP_NAME}BG] Handlers updated after config change.`)
    }
  })

  console.info(`[${APP_NAME}BG] Proxy extension background script initialized.`)
})()
