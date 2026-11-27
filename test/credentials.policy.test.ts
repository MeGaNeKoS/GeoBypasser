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

describe('exportProxyList with credentials included', () => {
  it('returns the same file contents as an export without the credentials option', () => {
    const list = [withCredentials, plain]

    const exported = JSON.stringify({ proxyList: exportProxyList(list, 'include') }, null, 2)

    expect(exported).toBe(JSON.stringify({ proxyList: list }, null, 2))
  })
})

describe('keepStoredCredentials for an import without credentials', () => {
  it('keeps the username and password already stored for the same id', () => {
    const imported = { ...plain, id: withCredentials.id, label: 'Renamed' }

    const merged = keepStoredCredentials([imported], [withCredentials])

    expect(merged).toEqual([{ ...imported, username: 'lab-user', password: 'lab-pass' }])
  })
})

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
