import { STORAGE_KEYS } from '@constant/storageKeys'
import { authChallengeListener, BackgroundName, startBackground, storeLocally } from './backgroundHarness'

const proxy = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, username: 'u', password: 'p' }
const stored = {
  [STORAGE_KEYS.proxyList]: [proxy],
  [STORAGE_KEYS.defaultProxy]: 'good',
}

describe.each(['firefox', 'chrome'] as BackgroundName[])('%s auth for a server challenge', name => {
  it('gives no credentials to a server challenge from the host and port of a configured proxy', async () => {
    storeLocally(stored)
    await startBackground(name)

    const result = await authChallengeListener(name)({ isProxy: false, challenger: { host: 'good.lan', port: 8080 } })

    expect(result).toEqual({})
  })
})
