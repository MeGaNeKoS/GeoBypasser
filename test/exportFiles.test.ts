import type { ProxyListItem } from '@customTypes/proxy'
import { buildConfigExport, buildConfigExportFromChoices, buildProxiesExport, type ConfigExportSelection, type ConfigExportSource } from '@utils/exportFiles'

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
const rule = { name: 'Example', proxyId: 'p1', match: ['*://a.example/*'], active: true }
const source: ConfigExportSource = {
  proxyList: [withCredentials, plain],
  perWebsiteOverride: { 'a.example': 'p1' },
  keepAliveRules: { p1: { active: true, tabUrls: ['https://a.example/'] } },
  rules: [rule],
}
const everything: ConfigExportSelection = {
  proxyIndexes: [0, 1],
  ruleIndexes: [0],
  overrideDomains: ['a.example'],
  keepAliveIds: ['p1'],
}
const labWithoutCredentials = { id: 'p1', type: 'http', host: 'proxy.lan', port: 8080, proxyDNS: false, label: 'Lab' }

describe('buildProxiesExport', () => {
  it('keeps the username and password of every proxy', () => {
    expect(buildProxiesExport([withCredentials, plain])).toEqual({ proxyList: [withCredentials, plain] })
  })
})

describe('buildConfigExport with credentials included', () => {
  it('keeps the username and password of each exported proxy', () => {
    const exported = buildConfigExport(source, everything, 'include')

    expect(exported.proxyList).toEqual([withCredentials, plain])
  })
})

describe('buildConfigExport with credentials left out', () => {
  it('removes the username and password and keeps every other proxy field', () => {
    const exported = buildConfigExport(source, everything, 'omit')

    expect(exported.proxyList).toEqual([labWithoutCredentials, plain])
    expect(exported.proxyList?.[0]).not.toHaveProperty('username')
    expect(exported.proxyList?.[0]).not.toHaveProperty('password')
  })
})

describe('buildConfigExportFromChoices', () => {
  it('writes the proxies, overrides and keep-alive rules named by the choices', () => {
    const exported = buildConfigExportFromChoices(source, {
      proxies: ['1'],
      rules: [],
      overrides: ['a.example'],
      keepAlive: ['p1'],
    }, 'include')

    expect(exported.proxyList).toEqual([plain])
    expect(exported.perWebsiteOverride).toEqual({ 'a.example': 'p1' })
    expect(exported.keepAliveRules).toEqual({ p1: { active: true, tabUrls: ['https://a.example/'] } })
    expect(exported).not.toHaveProperty('rules')
  })
})

describe('buildConfigExport for a selection', () => {
  it('writes every selected section', () => {
    const exported = buildConfigExport(source, everything, 'include')

    expect(Object.keys(exported).sort()).toEqual(['keepAliveRules', 'perWebsiteOverride', 'proxyList', 'rules'])
    expect(exported.perWebsiteOverride).toEqual({ 'a.example': 'p1' })
    expect(exported.keepAliveRules).toEqual({ p1: { active: true, tabUrls: ['https://a.example/'] } })
  })

  it('leaves the stored proxies with their credentials after an export with them left out', () => {
    buildConfigExport(source, everything, 'omit')

    expect(withCredentials.password).toBe('lab-pass')
  })
})
