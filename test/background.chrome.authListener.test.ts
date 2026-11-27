import { jest } from '@jest/globals'
import type { ProxyListItem } from '@customTypes/proxy'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { settle, storageChangeListeners, storeLocally } from './backgroundHarness'

const CONFIG_CHANGES = 10
const TEST_URL = 'https://example.com/'

function proxyFor (generation: number): ProxyListItem {
  return {
    id: 'p1',
    type: 'http',
    host: `proxy-${generation}.lan`,
    port: 8080,
    proxyDNS: false,
    username: `user-${generation}`,
    password: `pass-${generation}`,
  }
}

async function changeProxyList (proxy: ProxyListItem) {
  storeLocally({ [STORAGE_KEYS.proxyList]: [proxy] })
  const changes = { [STORAGE_KEYS.proxyList]: { oldValue: [], newValue: [proxy] } }
  await Promise.all(storageChangeListeners().map(listener => listener(changes, 'local')))
  await settle()
}

function challengeFor (proxy: ProxyListItem) {
  return { isProxy: true, url: TEST_URL, challenger: { host: proxy.host, port: proxy.port } }
}

describe('Chrome proxy auth listener across config changes', () => {
  const addAuthListener = jest.fn()

  beforeAll(async () => {
    Object.assign(global, { chrome: { webRequest: { onAuthRequired: { addListener: addAuthListener } } } })
    storeLocally({ [STORAGE_KEYS.proxyList]: [proxyFor(0)] })
    await import('../src/background.chrome')
    await settle()
  })

  it('registers exactly one auth listener through ten config changes', async () => {
    for (let generation = 1; generation <= CONFIG_CHANGES; generation++) {
      await changeProxyList(proxyFor(generation))
    }

    expect(addAuthListener).toHaveBeenCalledTimes(1)
  })

  it('answers from the latest proxy list and not an earlier one', async () => {
    const [listener] = addAuthListener.mock.calls[0] as [(details: unknown) => unknown]
    const latest = proxyFor(CONFIG_CHANGES)
    const earlier = proxyFor(1)

    expect(await listener(challengeFor(latest))).toEqual({
      authCredentials: { username: latest.username, password: latest.password },
    })
    expect(await listener(challengeFor(earlier))).toEqual({})
  })
})
