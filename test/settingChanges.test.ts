import { findSettingChanges } from '@utils/importFiles'
import type { ProxyListItem } from '@customTypes/proxy'

const proxies: ProxyListItem[] = [
  { id: 'p1', label: 'Office', type: 'http', proxyDNS: false, host: 'office.lan', port: 8080 },
  { id: 'p2', type: 'socks', proxyDNS: true, host: 'socks.lan', port: 1080 },
]

describe('setting changes listed for an import', () => {
  it('lists each changed setting in order with its old and new text', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: false, testProxyUrl: 'https://old.example/' }
    const imported = { defaultProxy: 'p2', fallbackDirect: true, testProxyUrl: 'https://new.example/' }

    expect(findSettingChanges(stored, imported, proxies)).toEqual([
      { setting: 'defaultProxy', title: 'Default proxy', oldText: 'Office', newText: 'socks.lan' },
      { setting: 'fallbackDirect', title: 'Connect directly when a proxy fails', oldText: 'Off', newText: 'On' },
      { setting: 'testProxyUrl', title: 'Test URL', oldText: 'https://old.example/', newText: 'https://new.example/' },
    ])
  })

  it('shows None for a default proxy or test URL that is not set', () => {
    const stored = { defaultProxy: undefined, fallbackDirect: true, testProxyUrl: undefined }
    const imported = { defaultProxy: 'p1', fallbackDirect: true, testProxyUrl: 'https://new.example/' }

    const changes = findSettingChanges(stored, imported, proxies)

    expect(changes.map(change => [change.setting, change.oldText])).toEqual([
      ['defaultProxy', 'None'],
      ['testProxyUrl', 'None'],
    ])
  })

  it('shows the raw proxy id with a note when the imported default proxy is not in the list', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: true, testProxyUrl: 'https://same.example/' }
    const imported = { defaultProxy: 'missing-id', fallbackDirect: true, testProxyUrl: 'https://same.example/' }

    expect(findSettingChanges(stored, imported, proxies)).toEqual([
      { setting: 'defaultProxy', title: 'Default proxy', oldText: 'Office', newText: 'missing-id (not in your list)' },
    ])
  })

  it('finds the proxy label past set-aside entries that the stored list still holds', () => {
    const setAside = [null, 'set aside text', {}] as unknown as ProxyListItem[]
    const stored = { defaultProxy: 'p1', fallbackDirect: true, testProxyUrl: 'https://same.example/' }
    const imported = { defaultProxy: 'p2', fallbackDirect: true, testProxyUrl: 'https://same.example/' }

    expect(findSettingChanges(stored, imported, [...setAside, ...proxies])[0]).toMatchObject({ oldText: 'Office', newText: 'socks.lan' })
  })

  it('shows None when the imported default proxy is an empty id', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: true, testProxyUrl: 'https://same.example/' }
    const imported = { defaultProxy: '', fallbackDirect: true, testProxyUrl: 'https://same.example/' }

    expect(findSettingChanges(stored, imported, proxies)[0]).toMatchObject({ oldText: 'Office', newText: 'None' })
  })
})
