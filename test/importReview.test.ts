import type { ProxyListItem } from '@customTypes/proxy'
import { refuseConfigFile } from '@utils/importFiles'
import type { ImportNote } from '@utils/importFiles'
import { applyImportDecisions, defaultDecisions, describeImported, describePlanned, reviewImport } from '@utils/importReview'
import type { ReviewTargets } from '@utils/importReview'

const office: ProxyListItem = { id: 'p1', label: 'Office', type: 'http', proxyDNS: false, host: 'office.lan', port: 8080 }
const tokyo: ProxyListItem = { id: 'p2', label: 'Tokyo', type: 'socks', proxyDNS: true, host: 'tokyo.lan', port: 1080 }
const newsRule = { active: true, name: 'News', match: ['https://news.example/*'], proxyId: 'p2' }
const keepAlive = { active: true, tabUrls: ['*.example.com'] }

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

function reviewOf (file: unknown) {
  const verdict = refuseConfigFile(file)
  return { verdict, review: reviewImport(stored, verdict.accepted, verdict.notes) }
}

describe('import review counts and offers', () => {
  it('counts the entries an import would add', () => {
    const { review } = reviewOf({
      proxyList: [tokyo],
      rules: [newsRule],
      keepAliveRules: { p2: keepAlive },
      perWebsiteOverride: { 'b.example': 'p2' },
    })

    expect(review.adds).toEqual({ proxies: 1, rules: 1, keepAliveRules: 1, siteOverrides: 1 })
    expect(review.duplicates).toEqual([])
    expect(review.canImport).toBe(true)
  })

  it('lists a proxy with the same host, port and username as a duplicate of the stored one', () => {
    const { review } = reviewOf({ proxyList: [{ ...office, id: 'p9', label: 'Office copy' }] })

    expect(review.duplicates).toEqual([{
      key: 'proxy:0',
      kind: 'proxy',
      label: 'office.lan:8080',
      allowedResolutions: ['keepExisting', 'useNew', 'keepBoth'],
      resolution: 'keepExisting',
      storedIndex: 0,
    }])
    expect(review.adds.proxies).toBe(0)
  })

  it('lists a website override whose domain is already stored as a duplicate that cannot be kept both', () => {
    const { review } = reviewOf({ perWebsiteOverride: { 'a.example': 'p2' } })

    expect(review.duplicates).toEqual([{
      key: 'site:a.example',
      kind: 'site',
      label: 'a.example',
      allowedResolutions: ['keepExisting', 'useNew'],
      resolution: 'keepExisting',
    }])
  })

  it('offers each changed setting, and keeps current by default', () => {
    const { review } = reviewOf({ defaultProxy: 'p2', testProxyUrl: 'https://new.example/' })

    expect(review.settingChanges.map(change => change.setting)).toEqual(['defaultProxy', 'testProxyUrl'])
    expect(defaultDecisions(review).settings).toEqual([])
  })

  it('groups notes by their kind, not by their wording', () => {
    const notes: ImportNote[] = [
      { kind: 'ignored', entry: 'News', text: 'Any wording at all' },
      { kind: 'refused', entry: 'Old', text: 'Rule "Old" was not imported: no match.' },
    ]

    const review = reviewImport(stored, {}, notes)

    expect(review.notes.refused).toEqual([notes[1]])
    expect(review.notes.ignored).toEqual([notes[0]])
  })

  it('describes what was added in the status line', () => {
    expect(describePlanned({ proxies: 1, rules: 4, keepAliveRules: 2, siteOverrides: 0 })).toBe('4 rules, 1 proxy, 2 keep-alive rules')
    expect(describePlanned({ proxies: 0, rules: 0, keepAliveRules: 0, siteOverrides: 1 })).toBe('1 site')
    expect(describeImported({ proxies: 1, rules: 4, keepAliveRules: 2, siteOverrides: 0 })).toBe('Imported 4 rules, 1 proxy, 2 keep-alive rules')
    expect(describeImported({ proxies: 0, rules: 0, keepAliveRules: 0, siteOverrides: 0 })).toBe('Nothing was imported')
  })
})

describe('applying the decisions made in the review', () => {
  it('keeps the stored duplicate by default and appends the new entries', () => {
    const { review, verdict } = reviewOf({
      proxyList: [{ ...office, id: 'p9' }, tokyo],
      rules: [newsRule],
      perWebsiteOverride: { 'b.example': 'p2' },
    })

    const applied = applyImportDecisions(stored, verdict.accepted, review, defaultDecisions(review), newId)

    expect(applied.targets.proxyList).toEqual([office, tokyo])
    expect(applied.targets.rules.map(rule => rule.name)).toEqual(['News'])
    expect(applied.targets.perWebsiteOverride).toEqual({ 'a.example': 'p1', 'b.example': 'p2' })
    expect(applied.added).toEqual({ proxies: 1, rules: 1, keepAliveRules: 0, siteOverrides: 1 })
  })

  it('replaces the stored proxy and keeps its id when Use new is chosen', () => {
    const incoming = { ...office, id: 'p9', label: 'Office new' }
    const { review, verdict } = reviewOf({ proxyList: [incoming] })

    const applied = applyImportDecisions(stored, verdict.accepted, review, { duplicates: { 'proxy:0': 'useNew' }, settings: [] }, newId)

    expect(applied.targets.proxyList).toEqual([{ ...incoming, id: 'p1' }])
    expect(applied.added.proxies).toBe(1)
  })

  it('appends a copy with a new id and a copy label when Keep both is chosen', () => {
    const { review, verdict } = reviewOf({ proxyList: [{ ...office, id: 'p9' }] })

    const applied = applyImportDecisions(stored, verdict.accepted, review, { duplicates: { 'proxy:0': 'keepBoth' }, settings: [] }, newId)

    expect(applied.targets.proxyList).toEqual([office, { ...office, id: 'new-id', label: 'Office (copy)' }])
  })

  it('replaces a stored website override and applies only the setting that was chosen', () => {
    const { review, verdict } = reviewOf({ perWebsiteOverride: { 'a.example': 'p2' }, defaultProxy: 'p2' })

    const applied = applyImportDecisions(stored, verdict.accepted, review, {
      duplicates: { 'site:a.example': 'useNew' },
      settings: ['defaultProxy'],
    }, newId)

    expect(applied.targets.perWebsiteOverride).toEqual({ 'a.example': 'p2' })
    expect(applied.targets.defaultProxy).toBe('p2')
    expect(applied.targets.testProxyUrl).toBe('https://old.example/')
    expect(applied.added.siteOverrides).toBe(1)
  })
})
