import { refuseKeepAliveRules, refuseOverrides, refuseProxyItems, refuseRules } from '@utils/importFiles'
import { usableKeepAliveRules, usableOverrides, usableProxies, usableRules } from '@utils/usable'

type Kind = 'rule' | 'proxy' | 'override' | 'keepAlive'

interface Entry {
  name: string
  kind: Kind
  value: unknown
  loaded: boolean
}

const SECTIONS: Record<Kind, { imports: (value: any) => boolean; loads: (value: any) => boolean }> = {
  rule: {
    imports: value => refuseRules([value]).accepted.length === 1,
    loads: value => usableRules([value]).length === 1,
  },
  proxy: {
    imports: value => refuseProxyItems([value]).accepted.length === 1,
    loads: value => usableProxies([value]).length === 1,
  },
  override: {
    imports: value => Object.keys(refuseOverrides(value).accepted).length === 1,
    loads: value => Object.keys(usableOverrides(value)).length === 1,
  },
  keepAlive: {
    imports: value => Object.keys(refuseKeepAliveRules(value).accepted).length === 1,
    loads: value => Object.keys(usableKeepAliveRules(value)).length === 1,
  },
}

const proxy = { id: 'p1', type: 'socks', proxyDNS: true, host: 'proxy_1.lan', port: 1080 }
const rule = { active: true, name: 'Example', match: ['https://example.com/*'], proxyId: 'p1' }
const keepAlive = { active: true, tabUrls: ['*.example.com'] }

const ENTRIES: Entry[] = [
  { name: 'rule', kind: 'rule', value: rule, loaded: true },
  { name: 'rule without an active field', kind: 'rule', value: { ...rule, active: undefined }, loaded: true },
  { name: 'rule with pattern "not a pattern"', kind: 'rule', value: { ...rule, match: ['not a pattern'] }, loaded: false },
  { name: 'rule without a proxy', kind: 'rule', value: { ...rule, proxyId: '' }, loaded: false },
  { name: 'rule with staticExtensions "/(/"', kind: 'rule', value: { ...rule, staticExtensions: '/(/' }, loaded: true },
  { name: 'rule with staticExtensions "/x/gg"', kind: 'rule', value: { ...rule, staticExtensions: '/x/gg' }, loaded: true },
  { name: 'rule with staticExtensions "\\.(png|css)$"', kind: 'rule', value: { ...rule, staticExtensions: '\\.(png|css)$' }, loaded: true },
  { name: 'proxy', kind: 'proxy', value: proxy, loaded: true },
  { name: 'proxy with host "a:1; PROXY x:8080"', kind: 'proxy', value: { ...proxy, host: 'a:1; PROXY x:8080' }, loaded: false },
  { name: 'proxy with a whitespace only host', kind: 'proxy', value: { ...proxy, host: '   ' }, loaded: false },
  { name: 'proxy with port 70000', kind: 'proxy', value: { ...proxy, port: 70000 }, loaded: false },
  { name: 'proxy without an id', kind: 'proxy', value: { ...proxy, id: '' }, loaded: false },
  { name: 'proxy with type "ftp"', kind: 'proxy', value: { ...proxy, type: 'ftp' }, loaded: false },
  { name: 'override', kind: 'override', value: { 'example.com': 'p1' }, loaded: true },
  { name: 'override with domain "exa mple.com"', kind: 'override', value: { 'exa mple.com': 'p1' }, loaded: false },
  { name: 'override with an empty proxy id', kind: 'override', value: { 'example.com': '' }, loaded: false },
  { name: 'keep-alive rule', kind: 'keepAlive', value: { p1: keepAlive }, loaded: true },
  { name: 'keep-alive rule with tab URL "not valid!"', kind: 'keepAlive', value: { p1: { active: true, tabUrls: ['not valid!'] } }, loaded: false },
  { name: 'keep-alive rule with test URL "www.google.com"', kind: 'keepAlive', value: { p1: { ...keepAlive, testProxyUrl: 'www.google.com' } }, loaded: true },
]

describe('the import and the loader agree on every entry', () => {
  it('imports an entry exactly when the loader uses it', () => {
    const disagreements = ENTRIES
      .filter(entry => SECTIONS[entry.kind].imports(entry.value) !== SECTIONS[entry.kind].loads(entry.value))
      .map(entry => entry.name)

    expect(disagreements).toEqual([])
  })

  it('matches the expected outcome for every entry on both sides', () => {
    const wrong = ENTRIES
      .filter(entry => SECTIONS[entry.kind].loads(entry.value) !== entry.loaded ||
        SECTIONS[entry.kind].imports(entry.value) !== entry.loaded)
      .map(entry => entry.name)

    expect(wrong).toEqual([])
  })
})
