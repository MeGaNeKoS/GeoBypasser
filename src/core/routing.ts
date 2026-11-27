import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyId } from '@customTypes/generic'
import type { Proxy } from 'webextension-polyfill'
import { getAllMatchUrls } from '@utils/generic'
import {
  makeDefaultProxyHandler,
  makeDomainProxyHandler,
  makeProxyHandler,
  makeTabProxyHandler,
  TabLookup,
} from '@utils/proxy'
import { APP_NAME } from '@constant/defaults'

export type ProxyRequestListener = (details: Proxy.OnRequestDetailsType) => void

export type RoutingPorts = {
  proxyRequests: {
    add: (listener: ProxyRequestListener, filter: { urls: string[] }) => void;
    remove: (listener: ProxyRequestListener) => void;
    has: (listener: ProxyRequestListener) => boolean;
  };
  lookupTab: TabLookup;
  persistTabProxyMap: (map: Record<number, ProxyId>) => unknown;
}

type ProxyHandlerSlots = {
  tab?: ProxyRequestListener;
  domain?: ProxyRequestListener;
  main?: ProxyRequestListener;
  default?: ProxyRequestListener;
}

const PROXY_HANDLER_SLOTS = ['tab', 'domain', 'main', 'default'] as const

export function createRouting (ports: RoutingPorts) {
  const tabProxyMap: Record<number, ProxyId> = {}
  const handlers: ProxyHandlerSlots = {}

  function persistTabProxyMap () {
    ports.persistTabProxyMap(tabProxyMap)
  }

  function attach (config: GeoBypassRuntimeSettings, changedKeys: string[] = []) {
    for (const slot of PROXY_HANDLER_SLOTS) {
      const handler = handlers[slot]
      if (handler && ports.proxyRequests.has(handler)) {
        ports.proxyRequests.remove(handler)
      }
    }

    const urls = getAllMatchUrls(config)

    if (!handlers.tab) {
      handlers.tab = makeTabProxyHandler(config, tabProxyMap)
    }

    if (!handlers.domain) {
      handlers.domain = makeDomainProxyHandler(config, ports.lookupTab)
    }

    if (!handlers.main || changedKeys.includes('rules')) {
      handlers.main = urls.length > 0 ? makeProxyHandler(config) : undefined
    }
    if (changedKeys.includes('defaultProxy')) {
      handlers.default = config.defaultProxy ? makeDefaultProxyHandler(config) : undefined
    } else if (!handlers.default && config.defaultProxy) {
      handlers.default = makeDefaultProxyHandler(config)
    }

    if (handlers.tab) ports.proxyRequests.add(handlers.tab, { urls: ['<all_urls>'] })
    if (handlers.domain) ports.proxyRequests.add(handlers.domain, { urls: ['<all_urls>'] })
    if (handlers.main) ports.proxyRequests.add(handlers.main, { urls })
    if (handlers.default) ports.proxyRequests.add(handlers.default, { urls: ['<all_urls>'] })
  }

  return {
    attach,
    tabProxyCount: () => Object.keys(tabProxyMap).length,
    setTabProxy (tabId: number, proxyId: ProxyId) {
      tabProxyMap[tabId] = proxyId
      persistTabProxyMap()
    },
    clearTabProxy (tabId: number) {
      delete tabProxyMap[tabId]
      persistTabProxyMap()
    },
    forgetTab (tabId: number) {
      if (!tabProxyMap[tabId]) return
      delete tabProxyMap[tabId]
      console.debug(`[${APP_NAME}BG] Removed tabProxyMap entry for closed tab ${tabId}`)
      persistTabProxyMap()
    },
    replaceTabProxyMap (map: Record<number, ProxyId>) {
      Object.keys(tabProxyMap).forEach(key => delete tabProxyMap[Number(key)])
      Object.assign(tabProxyMap, map)
    },
  }
}
