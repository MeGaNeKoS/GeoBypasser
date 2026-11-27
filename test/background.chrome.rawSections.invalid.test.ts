import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { startBackground, storageChangeListeners, storeLocally } from './backgroundHarness'

const proxy = { id: 'p1', type: 'http', host: 'h.lan', port: 8080, proxyDNS: false }
const rule = { active: true, name: 'r', match: ['https://example.com/*'], proxyId: 'p1' }

async function changeStoredRules (value: unknown) {
  const changes = { [STORAGE_KEYS.rules]: { newValue: value } }
  for (const listener of [...storageChangeListeners()]) await listener(changes, 'local')
}

function lastPacWithoutEscapes () {
  const [details] = (browser.proxy.settings.set as jest.Mock).mock.lastCall as [{ value: { pacScript: { data: string } } }]
  return details.value.pacScript.data.replace(/\\/g, '')
}

describe('Chrome background with a stored rules section that is not a list', () => {
  it('sets the section aside at load and on a live change', async () => {
    storeLocally({ [STORAGE_KEYS.proxyList]: [proxy], [STORAGE_KEYS.rules]: 'not a list' })
    await startBackground('chrome')
    expect(lastPacWithoutEscapes()).not.toContain('example.com')

    await changeStoredRules([rule])
    expect(lastPacWithoutEscapes()).toContain('example.com')

    await changeStoredRules('not a list')
    expect(lastPacWithoutEscapes()).not.toContain('example.com')
  })
})
