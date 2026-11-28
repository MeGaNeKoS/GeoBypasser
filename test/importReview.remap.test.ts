import type { ProxyListItem } from '@customTypes/proxy'
import type { KeepAliveProxyRule } from '@customTypes/proxy'
import { applyImportDecisions, reviewImport } from '@utils/importReview'
import type { DuplicateResolution, ImportDecisions, ReviewTargets } from '@utils/importReview'

const office: ProxyListItem = { id: 'p1', label: 'Office', type: 'http', proxyDNS: false, host: 'office.lan', port: 8080 }
const officeCopy: ProxyListItem = { ...office, id: 'p9' }
const tokyo: ProxyListItem = { id: 'p2', label: 'Tokyo', type: 'socks', proxyDNS: true, host: 'tokyo.lan', port: 1080 }
const newsRule = { active: true, name: 'News', match: ['https://news.example/*'], proxyId: 'p9' }
type KeepAliveEntry = KeepAliveProxyRule[string]

const keepAlive: KeepAliveEntry = { active: true, tabUrls: ['*.example.com'] }

const stored: ReviewTargets = {
  proxyList: [office],
  rules: [],
  keepAliveRules: {},
  perWebsiteOverride: { 'a.example': 'p1' },
  defaultProxy: 'p1',
  fallbackDirect: false,
  testProxyUrl: 'https://old.example/',
}

const newId = () => 'new-id'

function decide (duplicates: Record<string, DuplicateResolution>, settings: ImportDecisions['settings'] = []): ImportDecisions {
  return { duplicates, settings }
}

function applyWith (incoming: Partial<ReviewTargets>, decisions: ImportDecisions) {
  const review = reviewImport(stored, incoming, [], decisions)
  return applyImportDecisions(stored, incoming, review, decisions, newId).targets
}

describe('import ids follow the proxy each entry refers to', () => {
  it('sends rules, site overrides and the default proxy to the stored copy when the duplicate proxy is skipped', () => {
    const targets = applyWith({
      proxyList: [officeCopy],
      rules: [newsRule],
      perWebsiteOverride: { 'b.example': 'p9' },
      defaultProxy: 'p9',
    }, decide({ 'proxy:0': 'keepExisting' }, ['defaultProxy']))

    expect(targets.rules).toEqual([{ ...newsRule, proxyId: 'p1' }])
    expect(targets.perWebsiteOverride).toEqual({ 'a.example': 'p1', 'b.example': 'p1' })
    expect(targets.defaultProxy).toBe('p1')
  })

  it('sends references to the new id when the duplicate proxy is kept both', () => {
    const targets = applyWith({
      proxyList: [officeCopy],
      rules: [newsRule],
      perWebsiteOverride: { 'b.example': 'p9' },
    }, decide({ 'proxy:0': 'keepBoth' }))

    expect(targets.rules).toEqual([{ ...newsRule, proxyId: 'new-id' }])
    expect(targets.perWebsiteOverride).toEqual({ 'a.example': 'p1', 'b.example': 'new-id' })
  })

  it('leaves the id of a proxy that is added as it was', () => {
    const targets = applyWith({
      proxyList: [tokyo],
      rules: [{ ...newsRule, proxyId: 'p2' }],
    }, decide({}))

    expect(targets.rules).toEqual([{ ...newsRule, proxyId: 'p2' }])
  })

  it('moves a keep-alive rule to the stored id of its proxy when the duplicate proxy is skipped', () => {
    const targets = applyWith({
      proxyList: [officeCopy],
      keepAliveRules: { p9: keepAlive },
    }, decide({ 'proxy:0': 'keepExisting' }))

    expect(targets.keepAliveRules).toEqual({ p1: keepAlive })
  })
})
