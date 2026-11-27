import browser from 'webextension-polyfill'
import type { NetworkMonitor } from '@core/networkMonitor'
import type { KeepAlivePorts, KeepAliveTabListeners } from '@core/keepAlive'
import type { RoutingPorts } from '@core/routing'
import { testProxyConfigQueued } from '@utils/proxy'
import { saveTabProxyMap } from '@utils/storage'

export function registerFirefoxNetworkMonitor (monitor: NetworkMonitor) {
  browser.webRequest.onCompleted.addListener(
    details => {
      monitor.recordTransfer(details.tabId, details.url, {
        sentBytes: details.requestSize,
        receivedBytes: details.responseSize,
      })
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  )
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

export function firefoxRoutingPorts (): RoutingPorts {
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
