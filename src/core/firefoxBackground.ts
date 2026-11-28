import type { ProxyId } from '@customTypes/generic'
import type { Proxy } from 'webextension-polyfill'
import { answerProxyAuthWhenReady, type AuthChallenge, type ProxyAuthResponse, type ProxyListReady } from '@core/proxyAuth'
import { APP_NAME } from '@constant/defaults'
import { applyStorageChanges, createConfigState, type ConfigChangePorts, type ConfigState, type StorageChanges } from '@core/config'
import { createKeepAlive, type KeepAlivePorts, type KeepAliveTabListeners } from '@core/keepAlive'
import { isNetworkMessage, isTabProxyMessage, isTestProxyMessage } from '@utils/messages'
import { answerTestProxyMessage } from '@core/proxyTest'
import { runProxyTest } from '@utils/proxy'
import { createNetworkMonitor, type NetworkMonitor } from '@core/networkMonitor'
import { createRouting, type RoutingPorts } from '@core/routing'
import { createReadinessGate, type ReadinessGate } from '@core/readinessGate'
import type { StoredSections } from '@utils/storage'

export type FirefoxBackgroundPorts = {
  readStoredSections: () => Promise<StoredSections>;
  readStoredTabProxyMap: () => Promise<Record<number, ProxyId>>;
  routingPorts: Omit<RoutingPorts, 'noteRoute'>;
  keepAlivePorts: KeepAlivePorts;
  setKeepAliveListeners: (listeners: KeepAliveTabListeners | undefined) => void;
  registerProxyAuth: (listener: (details: AuthChallenge) => Promise<ProxyAuthResponse>) => void;
  registerNetworkMonitor: (monitor: NetworkMonitor) => void;
  broadcastNetworkMonitoring: (tabId: number, monitored: boolean) => void;
  onRuntimeMessage: (listener: (message: unknown) => unknown) => void;
  onTabRemoved: (listener: (tabId: number) => void) => void;
  onProxyError: (listener: (error: Proxy.OnErrorErrorType) => void) => void;
  onStorageChanged: (listener: (changes: StorageChanges, areaName: string) => Promise<void>) => void;
};

export function startFirefoxBackground (ports: FirefoxBackgroundPorts) {
  const networkMonitor = createNetworkMonitor(ports.broadcastNetworkMonitoring)
  const routing = createRouting({ ...ports.routingPorts, noteRoute: networkMonitor.noteRoute })
  const keepAlive = createKeepAlive(ports.keepAlivePorts)
  const configChangePorts: ConfigChangePorts = {
    routing,
    keepAlive,
    installKeepAliveListeners: ports.setKeepAliveListeners,
  }
  const configGate = createReadinessGate(() => loadConfigState(ports))
  const gate = createReadinessGate(() => loadInitialRuntime(configGate, ports, routing, keepAlive))

  const proxyListReady: ProxyListReady = use => configGate.whenReady(config => use(config.settings.proxyList))
  ports.registerProxyAuth(details => answerProxyAuthWhenReady(details, proxyListReady))
  ports.registerNetworkMonitor(networkMonitor)

  ports.onRuntimeMessage(message => {
    if (isTabProxyMessage(message)) return gate.whenReady(() => routing.answerTabProxyMessage(message))
    if (isNetworkMessage(message)) return Promise.resolve(networkMonitor.answerNetworkMessage(message))
    if (isTestProxyMessage(message)) {
      return configGate.whenReady(config => answerTestProxyMessage(message, config.settings, runProxyTest))
    }
    return undefined
  })

  ports.onTabRemoved(tabId => gate.whenReady(() => {
    routing.forgetTab(tabId)
    networkMonitor.forgetTab(tabId)
  }))

  ports.onProxyError(error => {
    console.error(`[${APP_NAME}BG] Proxy error occurred:`, error?.message)
  })

  ports.onStorageChanged(async (changes, areaName) => {
    await gate.whenReady(state => applyStorageChanges(state, changes, areaName, configChangePorts))
  })
}

async function loadConfigState (ports: FirefoxBackgroundPorts): Promise<ConfigState> {
  console.info(`[${APP_NAME}BG] Loading initial config...`)
  const state = createConfigState(await ports.readStoredSections())
  console.info(`[${APP_NAME}BG] Loaded initial config.`)
  return state
}

async function loadInitialRuntime (
  configGate: ReadinessGate<ConfigState>,
  ports: FirefoxBackgroundPorts,
  routing: ReturnType<typeof createRouting>,
  keepAlive: ReturnType<typeof createKeepAlive>,
): Promise<ConfigState> {
  const state = await configGate.whenReady(config => config)

  routing.replaceTabProxyMap(await ports.readStoredTabProxyMap())
  if (routing.tabProxyCount()) {
    console.info(`[${APP_NAME}BG] Loaded tab proxy mappings from storage.`)
  }

  routing.attach(state.settings)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  ports.setKeepAliveListeners(await keepAlive.restart(state.settings))
  console.info(`[${APP_NAME}BG] Proxy extension background script initialized and running.`)
  return state
}
