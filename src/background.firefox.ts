import { createProxyAuthListener } from '@core/proxyAuth'
import { APP_NAME } from '@constant/defaults'
import { applyStorageChanges, createConfigState, type ConfigChangePorts } from '@core/config'
import { createKeepAlive } from '@core/keepAlive'
import { isNetworkMessage, isTabProxyMessage } from '@utils/messages'
import { createNetworkMonitor } from '@core/networkMonitor'
import { createRouting } from '@core/routing'
import {
  firefoxKeepAlivePorts,
  firefoxRoutingPorts,
  onFirefoxProxyError,
  onFirefoxRuntimeMessage,
  onFirefoxStorageChanged,
  onFirefoxTabRemoved,
  readStoredSections,
  readStoredTabProxyMap,
  registerFirefoxNetworkMonitor,
  registerFirefoxProxyAuth,
  setFirefoxKeepAliveListeners,
} from '@adapters/firefox'

const networkMonitor = createNetworkMonitor()
const routing = createRouting(firefoxRoutingPorts())
const keepAlive = createKeepAlive(firefoxKeepAlivePorts())
const configChangePorts: ConfigChangePorts = {
  routing,
  keepAlive,
  installKeepAliveListeners: setFirefoxKeepAliveListeners,
}

void (async () => {
  console.info(`[${APP_NAME}BG] Loading initial config...`)
  const state = createConfigState(await readStoredSections())
  console.info(`[${APP_NAME}BG] Loaded initial config.`)

  routing.replaceTabProxyMap(await readStoredTabProxyMap())
  if (routing.tabProxyCount()) {
    console.info(`[${APP_NAME}BG] Loaded tab proxy mappings from storage.`)
  }

  registerFirefoxProxyAuth(createProxyAuthListener(() => state.settings.proxyList))
  routing.attach(state.settings)
  console.info(`[${APP_NAME}BG] Proxy handlers attached for initial config.`)

  setFirefoxKeepAliveListeners(await keepAlive.restart(state.settings))

  registerFirefoxNetworkMonitor(networkMonitor)

  onFirefoxRuntimeMessage(async message => {
    if (isTabProxyMessage(message)) return routing.answerTabProxyMessage(message)
    if (isNetworkMessage(message)) return networkMonitor.answerNetworkMessage(message)
  })

  onFirefoxTabRemoved(tabId => {
    routing.forgetTab(tabId)
    networkMonitor.forgetTab(tabId)
  })

  onFirefoxProxyError(error => {
    console.error(`[${APP_NAME}BG] Proxy error occurred:`, error?.message)
  })

  onFirefoxStorageChanged((changes, areaName) => applyStorageChanges(state, changes, areaName, configChangePorts))

  console.info(`[${APP_NAME}BG] Proxy extension background script initialized and running.`)
})()
