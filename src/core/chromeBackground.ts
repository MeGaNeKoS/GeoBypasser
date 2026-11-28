import type { Types } from 'webextension-polyfill'
import { answerProxyAuthWhenReady, type AuthChallenge, type ProxyAuthResponse, type ProxyListReady } from '@core/proxyAuth'
import { createProxyControl, isGetProxyControlMessage, type ProxyControlPorts } from '@core/proxyControl'
import { createPacRouting, type PacPorts } from '@core/routing'
import { applySectionChanges, createConfigState, type ConfigState, type StorageChanges } from '@core/config'
import { createNetworkMonitor, type NetworkMonitor, type RouteForRequest } from '@core/networkMonitor'
import { createReadinessGate, type ReadinessGate } from '@core/readinessGate'
import type { StoredSections } from '@utils/storage'
import { isNetworkMessage, isTestProxyMessage } from '@utils/messages'
import { answerTestProxyMessage } from '@core/proxyTest'
import { runProxyTest } from '@utils/proxy'
import { expectedRoute } from '@utils/expectedRoute'
import { expectedRecordedRoute } from '@utils/networkUsage'

export type ChromeBackgroundPorts = {
  readStoredSections: () => Promise<StoredSections>;
  readLevelOfControl: ProxyControlPorts['readLevelOfControl'];
  broadcastState: ProxyControlPorts['broadcastState'];
  setPacScript: PacPorts['setPacScript'];
  registerProxyAuth: (listener: (details: AuthChallenge, respond: (response: ProxyAuthResponse) => void) => void) => void;
  onProxyLevelChanged: (listener: (levelOfControl: Types.LevelOfControl) => Promise<void>) => void;
  onRuntimeMessage: (listener: (message: unknown) => unknown) => void;
  onStorageChanged: (listener: (changes: StorageChanges, areaName: string) => Promise<void>) => void;
  registerNetworkMonitor: (monitor: NetworkMonitor, routeFor: RouteForRequest) => void;
  onTabRemoved: (listener: (tabId: number) => void) => void;
};

type ChromeContext = {
  state: ConfigState;
  pac: ReturnType<typeof createPacRouting>;
  proxyControl: ReturnType<typeof createProxyControl>;
};

export function startChromeBackground (ports: ChromeBackgroundPorts) {
  const pac = createPacRouting({ setPacScript: ports.setPacScript })
  const configGate = createReadinessGate(async () => createConfigState(await ports.readStoredSections()))
  const gate = createReadinessGate(() => loadChromeContext(configGate, ports, pac))

  const proxyListReady: ProxyListReady = use => configGate.whenReady(config => use(config.settings.proxyList))
  ports.registerProxyAuth((details, respond) => {
    answerProxyAuthWhenReady(details, proxyListReady).then(respond)
  })
  ports.onProxyLevelChanged(async levelOfControl => {
    await gate.whenReady(({ proxyControl }) => proxyControl.levelOfControlChanged(levelOfControl))
  })
  ports.onRuntimeMessage(message => {
    if (!isGetProxyControlMessage(message)) return undefined
    return gate.whenReady(({ proxyControl }) => proxyControl.answerRequest(message))
  })
  ports.onStorageChanged(async (changes, areaName) => {
    await gate.whenReady(context => reapplyPacForSectionChanges(context, changes, areaName))
  })

  const networkMonitor = createNetworkMonitor()
  ports.registerNetworkMonitor(networkMonitor, requestUrl => configGate.whenReady(config => expectedRecordedRoute(expectedRoute(config.settings, requestUrl))))
  ports.onRuntimeMessage(message => {
    if (isNetworkMessage(message)) return Promise.resolve(networkMonitor.answerNetworkMessage(message))
    return undefined
  })
  ports.onTabRemoved(tabId => networkMonitor.forgetTab(tabId))

  ports.onRuntimeMessage(message => {
    if (!isTestProxyMessage(message)) return undefined
    return configGate.whenReady(config => answerTestProxyMessage(message, config.settings, runProxyTest))
  })
}

async function loadChromeContext (
  configGate: ReadinessGate<ConfigState>,
  ports: ChromeBackgroundPorts,
  pac: ReturnType<typeof createPacRouting>,
): Promise<ChromeContext> {
  const state = await configGate.whenReady(config => config)
  const proxyControl = createProxyControl({
    readLevelOfControl: ports.readLevelOfControl,
    broadcastState: ports.broadcastState,
    applyPac: () => pac.apply(state.settings),
  })
  await proxyControl.start()
  return { state, pac, proxyControl }
}

async function reapplyPacForSectionChanges (context: ChromeContext, changes: StorageChanges, areaName: string) {
  if (!applySectionChanges(context.state, changes, areaName).length) return
  await context.pac.apply(context.state.settings)
}
