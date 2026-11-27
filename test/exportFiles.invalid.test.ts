import type { ProxyListItem } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { buildConfigExport, type ConfigExportSelection, type ConfigExportSource } from '@utils/exportFiles'

const plain: ProxyListItem = { id: 'p2', type: 'socks', host: 'socks.lan', port: 1080, proxyDNS: true }
const rule = { name: 'Example', proxyId: 'p1', match: ['*://a.example/*'], active: true }
const source: ConfigExportSource = {
  proxyList: [{ id: 'p1', type: 'http', host: 'proxy.lan', port: 8080, proxyDNS: false, label: 'Lab' }, plain],
  perWebsiteOverride: { 'a.example': 'p1' },
  keepAliveRules: { p1: { active: true, tabUrls: ['https://a.example/'] } },
  rules: [rule],
}
const nothingSelected: ConfigExportSelection = {
  proxyIndexes: [],
  ruleIndexes: [],
  overrideDomains: [],
  keepAliveIds: [],
}

describe('a config export with nothing selected', () => {
  it('writes no section', () => {
    expect(buildConfigExport(source, nothingSelected, 'include')).toEqual({})
  })
})

describe('a rule whose proxy is not in the export', () => {
  it('falls back to the direct proxy', () => {
    const exported = buildConfigExport(source, { ...nothingSelected, proxyIndexes: [1], ruleIndexes: [0] }, 'include')

    expect(exported.rules?.[0]).toMatchObject({ name: 'Example', proxyId: DIRECT_PROXY_ID })
  })
})

describe('a set aside rule in a config export', () => {
  it('is written exactly as stored', () => {
    const setAside = { name: 'Example', proxyId: 'gone' }
    const exported = buildConfigExport({ ...source, rules: [setAside] }, { ...nothingSelected, ruleIndexes: [0] }, 'include')

    expect(exported.rules).toEqual([setAside])
  })
})
