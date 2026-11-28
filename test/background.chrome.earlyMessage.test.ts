import { startChromeBackground, type ChromeBackgroundPorts } from '@core/chromeBackground'
import { STORAGE_KEYS } from '@constant/storageKeys'
import type { StoredSections } from '@utils/storage'
import { proxyControlStateFor } from '@utils/proxyControl'

const LEVEL = 'controlled_by_this_extension'

const storedSections: StoredSections = {
  [STORAGE_KEYS.proxyList]: [],
  [STORAGE_KEYS.defaultProxy]: undefined,
  [STORAGE_KEYS.fallbackDirect]: false,
  [STORAGE_KEYS.testProxyUrl]: 'https://example.test/',
  [STORAGE_KEYS.rules]: [],
  [STORAGE_KEYS.keepAliveRules]: [],
  [STORAGE_KEYS.perWebsiteOverride]: {},
}

const settle = () => new Promise(resolve => setImmediate(resolve))

function chromePortsWithDeferredRead () {
  let finishRead!: (sections: StoredSections) => void
  const runtimeListeners: Array<(message: unknown) => unknown> = []
  const ports: ChromeBackgroundPorts = {
    readStoredSections: () => new Promise<StoredSections>(done => { finishRead = done }),
    readLevelOfControl: async () => LEVEL,
    broadcastState: async () => {},
    setPacScript: async () => {},
    registerProxyAuth: () => {},
    onProxyLevelChanged: () => {},
    onRuntimeMessage: listener => { runtimeListeners.push(listener) },
    onStorageChanged: () => {},
    registerNetworkMonitor: () => {},
    broadcastNetworkMonitoring: () => {},
    onTabRemoved: () => {},
  }
  return {
    ports,
    finishRead: () => finishRead(storedSections),
    sendRuntimeMessage: (message: unknown) => runtimeListeners.map(listener => listener(message)),
  }
}

describe('Chrome background message sent before the stored read resolves', () => {
  it('answers getProxyControl once the stored read and the initial proxy control apply finish', async () => {
    const chrome = chromePortsWithDeferredRead()
    startChromeBackground(chrome.ports)

    const [proxyControlAnswer] = chrome.sendRuntimeMessage({ type: 'getProxyControl' })
    let answered = false
    Promise.resolve(proxyControlAnswer).then(() => { answered = true })
    await settle()
    expect(answered).toBe(false)

    chrome.finishRead()
    await expect(proxyControlAnswer).resolves.toEqual({ state: proxyControlStateFor(LEVEL) })
  })
})
