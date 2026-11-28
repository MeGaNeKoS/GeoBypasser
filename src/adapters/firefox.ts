import browser, { Proxy } from 'webextension-polyfill'
import type { NetworkMonitor } from '@core/networkMonitor'
import type { KeepAlivePorts, KeepAliveTabListeners } from '@core/keepAlive'
import type { RoutingPorts } from '@core/routing'
import { WebRequestProxySchema } from '@schemas/webRequestProxy'
import { pageHostFor } from '@utils/networkUsage'
import { DIRECT_ROUTE, routeOfProxyInfo } from '@utils/pacRoute'
import { testProxyConfigQueued } from '@utils/proxy'
import { saveTabProxyMap } from '@utils/storage'
import { APP_NAME } from '@constant/defaults'

export { readStoredSections, getTabProxyMap as readStoredTabProxyMap } from '@utils/storage'

type ProxyAuthListener = Parameters<typeof browser.webRequest.onAuthRequired.addListener>[0]
type StorageChangedListener = Parameters<typeof browser.storage.onChanged.addListener>[0]

export function registerFirefoxProxyAuth (listener: ProxyAuthListener) {
  browser.webRequest.onAuthRequired.addListener(listener, { urls: ['<all_urls>'] }, ['blocking'])
}

export function onFirefoxRuntimeMessage (listener: (message: unknown) => unknown) {
  browser.runtime.onMessage.addListener(listener)
}

export function onFirefoxTabRemoved (listener: (tabId: number) => void) {
  browser.tabs.onRemoved.addListener(listener)
}

export function onFirefoxProxyError (listener: (error: Proxy.OnErrorErrorType) => void) {
  browser.proxy.onError.addListener(listener)
}

export function onFirefoxStorageChanged (listener: StorageChangedListener) {
  browser.storage.onChanged.addListener(listener)
}

function observedRouteOf (details: unknown): string | undefined {
  const parsed = WebRequestProxySchema.safeParse(details)
  if (!parsed.success) return undefined
  const { proxyInfo } = parsed.data
  return proxyInfo ? routeOfProxyInfo(proxyInfo) : DIRECT_ROUTE
}

export function registerFirefoxNetworkMonitor (monitor: NetworkMonitor) {
  browser.webRequest.onCompleted.addListener(
    details => {
      monitor.recordRequest(details.tabId, details.requestId, {
        pageHost: pageHostFor(details.url, details.documentUrl),
        requestUrl: details.url,
        resourceType: details.type,
        statusCode: details.statusCode,
        fromCache: details.fromCache,
        sentBytes: details.requestSize,
        receivedBytes: details.responseSize,
        receivedSizeKnown: true,
        observedRoute: observedRouteOf(details),
      })
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  )

  browser.webRequest.onErrorOccurred.addListener(
    details => {
      monitor.recordRequest(details.tabId, details.requestId, {
        pageHost: pageHostFor(details.url, details.documentUrl),
        requestUrl: details.url,
        resourceType: details.type,
        error: details.error,
        fromCache: details.fromCache,
        sentBytes: 0,
        receivedBytes: 0,
        receivedSizeKnown: true,
        observedRoute: observedRouteOf(details),
      })
    },
    { urls: ['<all_urls>'] },
  )
}

export function broadcastFirefoxNetworkMonitoring (tabId: number, monitored: boolean): void {
  void browser.runtime.sendMessage({ type: 'networkMonitoringChanged', tabId, monitored })
    .catch(() => console.debug(`[${APP_NAME}BG] No extension page is listening for network monitoring changes`))
}

export function firefoxKeepAlivePorts (): KeepAlivePorts {
  return {
    listTabs: () => browser.tabs.query({}),
    getTab: tabId => browser.tabs.get(tabId),
    checkProxy: testProxyConfigQueued,
    notifications: {
      show: (id, title, message) => {
        browser.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message })
      },
      clear: id => {
        browser.notifications.clear(id)
      },
    },
  }
}

let activeKeepAliveListeners: KeepAliveTabListeners | undefined

export function setFirefoxKeepAliveListeners (listeners: KeepAliveTabListeners | undefined) {
  if (activeKeepAliveListeners) removeKeepAliveListeners(activeKeepAliveListeners)
  activeKeepAliveListeners = listeners
  if (listeners) addKeepAliveListeners(listeners)
}

function addKeepAliveListeners (listeners: KeepAliveTabListeners) {
  browser.tabs.onUpdated.addListener(listeners.onUpdated)
  browser.tabs.onActivated.addListener(listeners.onActivated)
  browser.tabs.onRemoved.addListener(listeners.onRemoved)
}

function removeKeepAliveListeners (listeners: KeepAliveTabListeners) {
  browser.tabs.onUpdated.removeListener(listeners.onUpdated)
  browser.tabs.onActivated.removeListener(listeners.onActivated)
  browser.tabs.onRemoved.removeListener(listeners.onRemoved)
}

export function firefoxRoutingPorts (): Omit<RoutingPorts, 'noteRoute'> {
  return {
    proxyRequests: {
      add: (listener, filter) => browser.proxy.onRequest.addListener(listener, filter),
      remove: listener => browser.proxy.onRequest.removeListener(listener),
      has: listener => browser.proxy.onRequest.hasListener(listener),
    },
    lookupTab: tabId => browser.tabs.get(tabId),
    persistTabProxyMap: map => saveTabProxyMap(map),
  }
}
