import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { startBackground, storageChangeListeners, storeLocally } from './backgroundHarness'

const proxy = { id: 'p1', type: 'http', host: 'h.lan', port: 8080, proxyDNS: false }
const rule = { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1' }

async function changeStoredRules (value: unknown) {
  const changes = { [STORAGE_KEYS.rules]: { newValue: value } }
  for (const listener of [...storageChangeListeners()]) await listener(changes, 'local')
}

async function routeFor (url: string) {
  const results = await Promise.all(
    [...browser.proxy.onRequest._listeners].map(fn => fn({ url, type: 'main_frame', tabId: -1 })),
  )
  return JSON.stringify(results)
}

describe('Firefox background with a stored rules section that is not a list', () => {
  it('sets the section aside at load and on a live change', async () => {
    storeLocally({ [STORAGE_KEYS.proxyList]: [proxy], [STORAGE_KEYS.rules]: 'not a list' })
    await startBackground('firefox')
    expect(await routeFor('https://example.com/a')).not.toContain('h.lan')

    await changeStoredRules([rule])
    expect(await routeFor('https://example.com/a')).toContain('h.lan')

    await changeStoredRules('not a list')
    expect(await routeFor('https://example.com/a')).not.toContain('h.lan')
  })
})
