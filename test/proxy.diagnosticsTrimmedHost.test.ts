import { testProxyConfigQueued } from '@utils/proxy'
import type { ProxyListItem } from '@customTypes/proxy'

const padded: ProxyListItem = { id: 'good', type: 'http', host: ' good.lan ', port: 8080, proxyDNS: false } as any

describe('diagnostics proxy test with whitespace around its host', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reports the trimmed host', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response)
    const results: unknown[] = []
    await testProxyConfigQueued(padded, 'https://www.google.com/', r => results.push(r))
    expect(results).toEqual([{ success: true, proxy: 'good.lan:8080' }])
  })
})
