import type { ProxyListItem } from '@customTypes/proxy'
import { refuseConfigFile } from '@utils/importFiles'
import { applyImportDecisions, defaultDecisions, describePlanned, reviewImport } from '@utils/importReview'
import type { ReviewTargets } from '@utils/importReview'

const office: ProxyListItem = { id: 'p1', label: 'Office', type: 'http', proxyDNS: false, host: 'office.lan', port: 8080 }

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

describe('import review refuses to offer an import that changes nothing', () => {
  it.each([
    ['only a refused proxy', { proxyList: [{ id: '', type: 'http' }] }],
    ['a setting equal to the stored one', { defaultProxy: 'p1' }],
    ['an empty file', {}],
  ])('disables Import for %s', (_, file) => {
    const { review } = reviewOf(file)

    expect(review.canImport).toBe(false)
  })

  it('still reports the refused proxy when nothing can be imported', () => {
    const { review } = reviewOf({ proxyList: [{ id: '', type: 'http' }] })

    expect(review.notes.refused).toHaveLength(1)
    expect(review.adds.proxies).toBe(0)
  })

  it('enables Import when every incoming entry is a duplicate, since each can be replaced', () => {
    const { review } = reviewOf({ proxyList: [{ ...office, id: 'p9' }] })

    expect(review.adds.proxies).toBe(0)
    expect(review.canImport).toBe(true)
  })
})

describe('applying decisions leaves stored data alone unless told otherwise', () => {
  it('keeps stored proxies, overrides and settings when every choice is the default', () => {
    const { review, verdict } = reviewOf({
      proxyList: [{ ...office, id: 'p9' }],
      perWebsiteOverride: { 'a.example': 'p2' },
      defaultProxy: 'p2',
      testProxyUrl: 'https://new.example/',
    })

    const applied = applyImportDecisions(stored, verdict.accepted, review, defaultDecisions(review), newId)

    expect(applied.targets.proxyList).toEqual([office])
    expect(applied.targets.perWebsiteOverride).toEqual({ 'a.example': 'p1' })
    expect(applied.targets.defaultProxy).toBe('p1')
    expect(applied.targets.testProxyUrl).toBe('https://old.example/')
    expect(applied.added).toEqual({ proxies: 0, rules: 0, keepAliveRules: 0, siteOverrides: 0 })
  })

  it('refuses a resolution that the duplicate does not offer', () => {
    const { review, verdict } = reviewOf({ perWebsiteOverride: { 'a.example': 'p2' } })

    expect(() => applyImportDecisions(stored, verdict.accepted, review, {
      duplicates: { 'site:a.example': 'keepBoth' },
      settings: [],
    }, newId)).toThrow('Duplicate site:a.example does not offer keepBoth')
  })

  it('does not apply a setting the user did not choose, even when it changed', () => {
    const { review, verdict } = reviewOf({ defaultProxy: 'p2' })

    const applied = applyImportDecisions(stored, verdict.accepted, review, defaultDecisions(review), newId)

    expect(applied.targets.defaultProxy).toBe('p1')
  })
})

describe('the status line after an import with nothing added', () => {
  it('says nothing was imported', () => {
    expect(describePlanned({ proxies: 0, rules: 0, keepAliveRules: 0, siteOverrides: 0 })).toBe('Nothing new to add')
  })
})
