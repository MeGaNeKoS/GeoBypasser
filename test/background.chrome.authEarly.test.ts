import { startChromeBackground, type ChromeBackgroundPorts } from '@core/chromeBackground'
import type { AuthChallenge, ProxyAuthResponse } from '@core/proxyAuth'
import { STORAGE_KEYS } from '@constant/storageKeys'
import type { StoredSections } from '@utils/storage'

const LEVEL = 'controlled_by_this_extension'

const storedSections: StoredSections = {
  [STORAGE_KEYS.proxyList]: [
    { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, username: 'u', password: 'p' },
  ],
  [STORAGE_KEYS.defaultProxy]: 'good',
  [STORAGE_KEYS.fallbackDirect]: false,
  [STORAGE_KEYS.testProxyUrl]: 'https://example.test/',
  [STORAGE_KEYS.rules]: [],
  [STORAGE_KEYS.keepAliveRules]: [],
  [STORAGE_KEYS.perWebsiteOverride]: {},
}

const settle = () => new Promise(resolve => setImmediate(resolve))

type AuthListener = (details: AuthChallenge, respond: (response: ProxyAuthResponse) => void) => void

function chromePortsWithDeferredRead () {
  let finishRead!: (sections: StoredSections) => void
  const authListeners: AuthListener[] = []
  const ports: ChromeBackgroundPorts = {
    readStoredSections: () => new Promise<StoredSections>(done => { finishRead = done }),
    readLevelOfControl: async () => LEVEL,
    broadcastState: async () => {},
    setPacScript: async () => {},
    registerProxyAuth: listener => { authListeners.push(listener) },
    onProxyLevelChanged: () => {},
    onRuntimeMessage: () => {},
    onStorageChanged: () => {},
    registerNetworkMonitor: () => {},
    broadcastNetworkMonitoring: () => {},
    broadcastNetworkUsageChanged: () => {},
    onTabRemoved: () => {},
  }
  return {
    ports,
    finishRead: () => finishRead(storedSections),
    challenge: (details: AuthChallenge) => new Promise<ProxyAuthResponse>(respond => authListeners[0](details, respond)),
  }
}

describe('Chrome auth challenge arriving before the stored read resolves', () => {
  it('answers with the stored credentials once the stored read finishes', async () => {
    const chrome = chromePortsWithDeferredRead()
    startChromeBackground(chrome.ports)

    let answered = false
    const answer = chrome.challenge({ isProxy: true, challenger: { host: 'good.lan', port: 8080 } })
      .then(response => { answered = true; return response })
    await settle()
    expect(answered).toBe(false)

    chrome.finishRead()
    await expect(answer).resolves.toEqual({ authCredentials: { username: 'u', password: 'p' } })
  })
})
