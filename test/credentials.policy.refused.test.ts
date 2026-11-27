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
const plain: ProxyListItem = { id: 'p2', type: 'socks', host: 'socks.lan', port: 1080, proxyDNS: true }

describe('exportProxyList with credentials omitted', () => {
  it('leaves out the username and password of every proxy', () => {
    const exported = exportProxyList([withCredentials, plain], 'omit')

    for (const proxy of exported) {
      expect(proxy).not.toHaveProperty('username')
      expect(proxy).not.toHaveProperty('password')
    }
  })

  it('keeps every other field of each proxy', () => {
    const [exported] = exportProxyList([withCredentials], 'omit')

    expect(exported).toEqual({ id: 'p1', type: 'http', host: 'proxy.lan', port: 8080, proxyDNS: false, label: 'Lab' })
  })

  it('leaves the stored proxies unchanged', () => {
    exportProxyList([withCredentials], 'omit')

    expect(withCredentials.password).toBe('lab-pass')
  })
})

describe('keepStoredCredentials for an import with its own credentials', () => {
  it('keeps the credentials the imported proxy carries over the stored ones', () => {
    const imported = { ...withCredentials, username: 'new-user', password: 'new-pass' }

    const merged = keepStoredCredentials([imported], [withCredentials])

    expect(merged).toEqual([imported])
  })

  it('adds no credentials when no stored proxy has the same id', () => {
    const merged = keepStoredCredentials([plain], [withCredentials])

    expect(merged).toEqual([plain])
    expect(merged[0]).not.toHaveProperty('username')
  })
})

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
