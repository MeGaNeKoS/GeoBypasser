import { createProxyAuthListener } from '@core/proxyAuth'
import { createProxyControl } from '@core/proxyControl'
import { createPacRouting } from '@core/routing'
import { applySectionChanges, createConfigState } from '@core/config'
import { createNetworkMonitor } from '@core/networkMonitor'
import { isNetworkMessage } from '@utils/messages'
import {
  broadcastChromeProxyControl,
  onChromeProxyLevelChanged,
  onChromeRuntimeMessage,
  onChromeStorageChanged,
  onChromeTabRemoved,
  readChromeLevelOfControl,
  readStoredSections,
  registerChromeNetworkMonitor,
  registerChromeProxyAuth,
  setChromePacScript,
} from '@adapters/chrome'

(async () => {
  const state = createConfigState(await readStoredSections())
  const pac = createPacRouting({ setPacScript: setChromePacScript })
  const proxyControl = createProxyControl({
    readLevelOfControl: readChromeLevelOfControl,
    broadcastState: broadcastChromeProxyControl,
    applyPac: () => pac.apply(state.settings),
  })

  registerChromeProxyAuth(createProxyAuthListener(() => state.settings.proxyList))
  onChromeProxyLevelChanged(levelOfControl => proxyControl.levelOfControlChanged(levelOfControl))
  onChromeRuntimeMessage(message => proxyControl.answerRequest(message))
  await proxyControl.start()

  onChromeStorageChanged(async (changes, areaName) => {
    if (!applySectionChanges(state, changes, areaName).length) return
    await pac.apply(state.settings)
  })

  const networkMonitor = createNetworkMonitor()
  registerChromeNetworkMonitor(networkMonitor)
  onChromeRuntimeMessage(async message => {
    if (isNetworkMessage(message)) return networkMonitor.answerNetworkMessage(message)
  })
  onChromeTabRemoved(tabId => networkMonitor.forgetTab(tabId))
})()
