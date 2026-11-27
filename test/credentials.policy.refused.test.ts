import type { ProxyListItem } from '@customTypes/proxy'
import { exportProxyList, keepStoredCredentials } from '@utils/proxyCredentials'

const withCredentials: ProxyListItem = {
  id: 'p1',
  type: 'http',
  host: 'proxy.lan',
  port: 8080,
  proxyDNS: false,
  label: 'Lab',
  username: 'lab-user',
  password: 'lab-pass',
}

describe('set-aside entries in the proxy lists', () => {
  const setAside = [null, 'set aside text', {}]

  it('exports set-aside entries unchanged, without throwing', () => {
    const exported = exportProxyList([...setAside, withCredentials], 'omit')

    expect(exported.slice(0, setAside.length)).toEqual(setAside)
    expect(exported[setAside.length]).not.toHaveProperty('password')
  })

  it('ignores set-aside entries in the stored list when filling credentials', () => {
    const bare: ProxyListItem = { id: 'p1', type: 'http', host: 'proxy.lan', port: 8080, proxyDNS: false }

    const merged = keepStoredCredentials([bare], [...setAside, withCredentials])

    expect(merged).toEqual([{ ...bare, username: 'lab-user', password: 'lab-pass' }])
  })
})
