import { browser } from './setup'
import { STORAGE_KEYS } from '@constant/storageKeys'

const padded = { id: 'good', type: 'http', host: ' good.lan ', port: 8080, proxyDNS: false, username: 'u', password: 'p' }

const stored: Record<string, unknown> = {
  [STORAGE_KEYS.proxyList]: [padded],
  [STORAGE_KEYS.defaultProxy]: 'good',
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('Chrome auth for a proxy with whitespace around its host', () => {
  it('provides the stored credentials when challenged by the trimmed host', async () => {
    const addAuth = jest.fn()
    ;(global as any).chrome = { webRequest: { onAuthRequired: { addListener: addAuth } } }
    browser.storage.local.get.mockImplementation(async (keys: any) => {
      if (typeof keys === 'string') return {}
      return Object.fromEntries((keys as string[]).filter(k => k in stored).map(k => [k, stored[k]]))
    })

    await import('../src/background.chrome')
    await flush()

    const authListener = addAuth.mock.calls[0][0]
    const result = authListener({ challenger: { host: 'good.lan', port: 8080 } })
    expect(result).toEqual({ authCredentials: { username: 'u', password: 'p' } })
  })
})
