import { findSettingChanges } from '@utils/importFiles'
import type { ProxyListItem } from '@customTypes/proxy'

const proxies: ProxyListItem[] = [
  { id: 'p1', label: 'Office', type: 'http', proxyDNS: false, host: 'office.lan', port: 8080 },
]

describe('import asks nothing about a setting it does not change', () => {
  it('asks nothing when every carried value equals the stored value', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: false, testProxyUrl: 'https://same.example/' }

    expect(findSettingChanges(stored, { ...stored }, proxies)).toEqual([])
  })

  it('asks nothing about a setting the import does not carry', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: false, testProxyUrl: 'https://same.example/' }
    const imported = { defaultProxy: undefined, fallbackDirect: undefined, testProxyUrl: undefined }

    expect(findSettingChanges(stored, imported, proxies)).toEqual([])
  })

  it('asks nothing about an unset stored value when the import does not carry it', () => {
    const stored = { defaultProxy: undefined, fallbackDirect: true, testProxyUrl: undefined }
    const imported = { defaultProxy: undefined, fallbackDirect: true, testProxyUrl: undefined }

    expect(findSettingChanges(stored, imported, proxies)).toEqual([])
  })
})
