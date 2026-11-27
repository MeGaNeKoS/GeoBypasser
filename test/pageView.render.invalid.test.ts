import { keepAliveRows, overrideRows, popupRules, proxyOptions, proxyRows, ruleRows } from '@utils/pageView'
import { compileRules } from '@utils/storage'

const good = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }
const inactiveRule = { active: false, name: 'off', match: ['https://example.org/*'], proxyId: 'good' }
const setAsideRule = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good' }

const proxyList: unknown[] = [null, 'text', {}, { id: 'partial' }, good]
const rules: unknown[] = [null, 'text', {}, { name: 'partial' }, goodRule, inactiveRule, setAsideRule]
const perWebsiteOverride: Record<string, unknown> = {
  'a.example': null,
  'b.example': {},
  'c.example': 'good',
  'bad domain.example': 'good',
}
const keepAliveRules: Record<string, unknown> = {
  a: null,
  b: 'text',
  c: {},
  d: { active: true },
  good: { active: true, tabUrls: ['example.com'] },
}

describe('page views built from a config with wrong-type and set aside entries', () => {
  it('builds every page view without an exception', () => {
    expect(() => {
      proxyRows(proxyList, () => true)
      ruleRows(compileRules(rules as any[]), proxyList)
      proxyOptions(proxyList)
      popupRules(compileRules(rules as any[]), true)
      overrideRows(perWebsiteOverride, proxyList)
      keepAliveRows(keepAliveRules, proxyList)
    }).not.toThrow()
  })

  it('keeps every proxy row at its stored index and marks the set aside ones invalid', () => {
    const rows = proxyRows(proxyList)
    expect(rows.map(r => r.index)).toEqual([0, 1, 2, 3, 4])
    expect(rows.map(r => r.invalid)).toEqual([true, true, true, true, false])
  })

  it('shows the stored fields of a usable proxy row and blanks for the missing ones', () => {
    const rows = proxyRows(proxyList)
    expect(rows[4]).toMatchObject({ label: 'Good', type: 'http', host: 'good.lan', port: '8080', username: '' })
    expect(rows[3]).toMatchObject({ label: '', type: '', host: '', port: '', username: '' })
  })

  it('keeps every rule row at its stored index and marks the set aside ones invalid', () => {
    const rows = ruleRows(compileRules(rules as any[]), proxyList)
    expect(rows.map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(rows.map(r => r.invalid)).toEqual([true, true, true, true, false, false, true])
  })

  it('shows the stored text of a usable rule row and blanks for a rule without a match list', () => {
    const rows = ruleRows(compileRules(rules as any[]), proxyList)
    expect(rows[4]).toMatchObject({ name: 'good', match: 'https://example.com/*', proxyLabel: 'Good', missingProxy: false })
    expect(rows[3]).toMatchObject({ name: 'partial', match: '', missingProxy: true })
  })

  it('lists only usable proxies in proxy selects', () => {
    expect(proxyOptions(proxyList).map(p => p.id)).toEqual(['good'])
  })

  it('does not list set aside rules in the popup', () => {
    const active = popupRules(compileRules(rules as any[]), true)
    const inactive = popupRules(compileRules(rules as any[]), false)
    expect(active.map(r => r.name)).toEqual(['good'])
    expect(inactive.map(r => r.name)).toEqual(['off'])
  })

  it('lists only usable website overrides with their proxy label', () => {
    expect(overrideRows(perWebsiteOverride, proxyList)).toEqual([{ domain: 'c.example', proxyLabel: 'Good' }])
  })

  it('lists only usable keep-alive rules, and each row writes to the stored entry', () => {
    const rows = keepAliveRows(keepAliveRules, proxyList)
    expect(rows.map(r => r.proxyId)).toEqual(['good'])
    expect(rows[0]).toMatchObject({ tabUrls: 'example.com', proxyLabel: 'Good', active: true })
    expect(rows[0].raw).toBe(keepAliveRules.good)
  })
})
