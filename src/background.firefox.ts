import { startFirefoxBackground } from '@core/firefoxBackground'
import {
  firefoxKeepAlivePorts,
  firefoxRoutingPorts,
  onFirefoxProxyError,
  onFirefoxRuntimeMessage,
  onFirefoxStorageChanged,
  broadcastFirefoxNetworkMonitoring,
  onFirefoxTabRemoved,
  readStoredSections,
  readStoredTabProxyMap,
  registerFirefoxNetworkMonitor,
  registerFirefoxProxyAuth,
  setFirefoxKeepAliveListeners,
} from '@adapters/firefox'

startFirefoxBackground({
  readStoredSections,
  readStoredTabProxyMap,
  routingPorts: firefoxRoutingPorts(),
  keepAlivePorts: firefoxKeepAlivePorts(),
  setKeepAliveListeners: setFirefoxKeepAliveListeners,
  registerProxyAuth: registerFirefoxProxyAuth,
  registerNetworkMonitor: registerFirefoxNetworkMonitor,
  broadcastNetworkMonitoring: broadcastFirefoxNetworkMonitoring,
  onRuntimeMessage: onFirefoxRuntimeMessage,
  onTabRemoved: onFirefoxTabRemoved,
  onProxyError: onFirefoxProxyError,
  onStorageChanged: onFirefoxStorageChanged,
})
