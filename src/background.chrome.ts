import { createProxyAuthListener } from '@core/proxyAuth'
import { createProxyControl } from '@core/proxyControl'
import { createPacRouting } from '@core/routing'
import { isConfigChange } from '@core/config'
import { createNetworkMonitor } from '@core/networkMonitor'
import { isNetworkMessage } from '@utils/messages'
import {
  broadcastChromeProxyControl,
  onChromeProxyLevelChanged,
  onChromeRuntimeMessage,
  onChromeStorageChanged,
  onChromeTabRemoved,
  readChromeLevelOfControl,
  readStoredConfig,
  registerChromeNetworkMonitor,
  registerChromeProxyAuth,
  setChromePacScript,
} from '@adapters/chrome'

(async () => {
  let config = await readStoredConfig()
  const pac = createPacRouting({ setPacScript: setChromePacScript })
  const proxyControl = createProxyControl({
    readLevelOfControl: readChromeLevelOfControl,
    broadcastState: broadcastChromeProxyControl,
    applyPac: () => pac.apply(config),
  })

  registerChromeProxyAuth(createProxyAuthListener(() => config.proxyList))
  onChromeProxyLevelChanged(levelOfControl => proxyControl.levelOfControlChanged(levelOfControl))
  onChromeRuntimeMessage(message => proxyControl.answerRequest(message))
  await proxyControl.start()

  onChromeStorageChanged(async (changes, areaName) => {
    if (!isConfigChange(changes, areaName)) return
    config = await readStoredConfig()
    await pac.apply(config)
  })

  const networkMonitor = createNetworkMonitor()
  registerChromeNetworkMonitor(networkMonitor)
  onChromeRuntimeMessage(async message => {
    if (isNetworkMessage(message)) return networkMonitor.answerNetworkMessage(message)
  })
  onChromeTabRemoved(tabId => networkMonitor.forgetTab(tabId))
})()
