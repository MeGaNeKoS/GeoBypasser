import { startChromeBackground } from '@core/chromeBackground'
import { readStoredSections } from '@adapters/chrome'
import {
  broadcastChromeProxyControl,
  onChromeProxyLevelChanged,
  onChromeRuntimeMessage,
  onChromeStorageChanged,
  onChromeTabRemoved,
  readChromeLevelOfControl,
  registerChromeNetworkMonitor,
  registerChromeProxyAuth,
  setChromePacScript,
} from '@adapters/chrome'

startChromeBackground({
  readStoredSections,
  readLevelOfControl: readChromeLevelOfControl,
  broadcastState: broadcastChromeProxyControl,
  setPacScript: setChromePacScript,
  registerProxyAuth: registerChromeProxyAuth,
  onProxyLevelChanged: onChromeProxyLevelChanged,
  onRuntimeMessage: onChromeRuntimeMessage,
  onStorageChanged: onChromeStorageChanged,
  registerNetworkMonitor: registerChromeNetworkMonitor,
  onTabRemoved: onChromeTabRemoved,
})
