import { startFirefoxBackground, type FirefoxBackgroundPorts } from '@core/firefoxBackground'
import { STORAGE_KEYS } from '@constant/storageKeys'
import type { StoredSections } from '@utils/storage'

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

function firefoxPortsWithDeferredTabMap () {
  let finishTabMapRead!: (map: Record<number, string>) => void
  const runtimeListeners: Array<(message: unknown) => unknown> = []
  const persistTabProxyMap = jest.fn()
  const ports: FirefoxBackgroundPorts = {
    readStoredSections: async () => storedSections,
    readStoredTabProxyMap: () => new Promise<Record<number, string>>(done => { finishTabMapRead = done }),
    routingPorts: {
      proxyRequests: { add: () => {}, remove: () => {}, has: () => false },
      lookupTab: async () => ({ url: 'https://example.test/' }),
      persistTabProxyMap,
    },
    keepAlivePorts: {
      listTabs: async () => [],
      getTab: async () => { throw new Error('no tab is tracked') },
      checkProxy: () => {},
      notifications: { show: () => {}, clear: () => {} },
    },
    setKeepAliveListeners: () => {},
    registerProxyAuth: () => {},
    registerNetworkMonitor: () => {},
    broadcastNetworkMonitoring: () => {},
    onRuntimeMessage: listener => { runtimeListeners.push(listener) },
    onTabRemoved: () => {},
    onProxyError: () => {},
    onStorageChanged: () => {},
  }
  return {
    ports,
    persistTabProxyMap,
    finishTabMapRead: (map: Record<number, string>) => finishTabMapRead(map),
    sendRuntimeMessage: (message: unknown) => runtimeListeners.map(listener => listener(message)),
  }
}

describe('Firefox background message sent before the stored tab map resolves', () => {
  it('applies a setTabProxy message on top of the stored tab map once that map has loaded', async () => {
    const firefox = firefoxPortsWithDeferredTabMap()
    startFirefoxBackground(firefox.ports)

    const [answer] = firefox.sendRuntimeMessage({ type: 'setTabProxy', tabId: 4, proxyId: 'proxy-new' })
    let answered = false
    Promise.resolve(answer).then(() => { answered = true })
    await settle()
    expect(answered).toBe(false)
    expect(firefox.persistTabProxyMap).not.toHaveBeenCalled()

    firefox.finishTabMapRead({ 2: 'proxy-old' })
    await answer
    expect(firefox.persistTabProxyMap).toHaveBeenLastCalledWith({ 2: 'proxy-old', 4: 'proxy-new' })
  })
})
