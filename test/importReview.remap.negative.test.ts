import type { KeepAliveProxyRule, ProxyListItem } from '@customTypes/proxy'
import { applyImportDecisions, reviewImport } from '@utils/importReview'
import type { DuplicateResolution, ImportDecisions, ReviewTargets } from '@utils/importReview'

const office: ProxyListItem = { id: 'p1', label: 'Office', type: 'http', proxyDNS: false, host: 'office.lan', port: 8080 }
const officeCopy: ProxyListItem = { ...office, id: 'p9' }
type KeepAliveEntry = KeepAliveProxyRule[string]

const storedRule: KeepAliveEntry = { active: false, tabUrls: ['stored.example'] }
const incomingRule: KeepAliveEntry = { active: true, tabUrls: ['*.example.com'] }

const stored: ReviewTargets = {
  proxyList: [office],
  rules: [],
  keepAliveRules: { p1: storedRule },
  perWebsiteOverride: {},
  defaultProxy: 'p1',
  fallbackDirect: false,
  testProxyUrl: 'https://old.example/',
}

const incoming: Partial<ReviewTargets> = { proxyList: [officeCopy], keepAliveRules: { p9: incomingRule } }

const newId = () => 'new-id'

function decide (duplicates: Record<string, DuplicateResolution>): ImportDecisions {
  return { duplicates, settings: [] }
}

function applyWith (decisions: ImportDecisions) {
  const review = reviewImport(stored, incoming, [], decisions)
  return { review, targets: applyImportDecisions(stored, incoming, review, decisions, newId).targets }
}

describe('a keep-alive rule that lands on a stored proxy id', () => {
  it('is listed as a duplicate named after its proxy and keeps the stored rule by default', () => {
    const { review, targets } = applyWith(decide({ 'proxy:0': 'keepExisting' }))

    expect(review.duplicates).toContainEqual(expect.objectContaining({
      key: 'keepAlive:p1',
      kind: 'keepAlive',
      label: 'Office',
      allowedResolutions: ['keepExisting', 'useNew'],
      resolution: 'keepExisting',
    }))
    expect(targets.keepAliveRules).toEqual({ p1: storedRule })
  })

  it('takes the incoming rule when the duplicate is resolved to use the new one', () => {
    const { targets } = applyWith(decide({ 'proxy:0': 'keepExisting', 'keepAlive:p1': 'useNew' }))

    expect(targets.keepAliveRules).toEqual({ p1: incomingRule })
  })

  it('is no duplicate once its proxy is kept both, because the rule moves to the new id', () => {
    const { review, targets } = applyWith(decide({ 'proxy:0': 'keepBoth' }))

    expect(review.duplicates.filter(duplicate => duplicate.kind === 'keepAlive')).toEqual([])
    expect(targets.keepAliveRules).toEqual({ p1: storedRule, 'new-id': incomingRule })
  })
})
