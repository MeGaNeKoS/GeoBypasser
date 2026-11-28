import { hostForTabUrl, needsFixingLine, popupRuleRows, popupRuleSummary, popupTestResultLine, popupUsingLine } from '@utils/popupView'
import type { ProxyListItem } from '@customTypes/proxy'

const setAside: ProxyListItem = { id: 'broken', label: 'Broken' } as any

describe('the Using line without a proxy or with an unknown one', () => {
  it('reads No site proxy when nothing is set, even when control is elsewhere', () => {
    expect(popupUsingLine({ scope: 'site', tabProxyId: undefined, siteProxyId: undefined, proxyList: [], notInEffect: true }))
      .toBe('No site proxy')
    expect(popupUsingLine({ scope: 'site', tabProxyId: undefined, siteProxyId: undefined, proxyList: [], notInEffect: false }))
      .toBe('No site proxy')
  })

  it('reads No tab proxy when neither a tab nor a site proxy is set on a tab scope', () => {
    expect(popupUsingLine({ scope: 'tab', tabProxyId: undefined, siteProxyId: undefined, proxyList: [], notInEffect: false }))
      .toBe('No tab proxy')
  })

  it('names an id that is not in the proxy list as unavailable', () => {
    expect(popupUsingLine({ scope: 'tab', tabProxyId: 'ghost', siteProxyId: undefined, proxyList: [], notInEffect: false }))
      .toBe('Unavailable: ghost (set for this tab)')
  })

  it('names a set aside proxy as unavailable, not as in use', () => {
    expect(popupUsingLine({ scope: 'site', tabProxyId: undefined, siteProxyId: 'broken', proxyList: [setAside], notInEffect: false }))
      .toBe('Unavailable: broken (set for this site)')
  })
})

describe('the popup rule summary with no rules', () => {
  it('reports nothing stored when the rules are missing', () => {
    expect(popupRuleSummary(undefined)).toEqual({ total: 0, needsFixing: 0, active: 0, inactive: 0 })
  })

  it('reports nothing stored when the rules are not a list', () => {
    expect(popupRuleSummary('rules')).toEqual({ total: 0, needsFixing: 0, active: 0, inactive: 0 })
  })
})

describe('the popup rule list text without faults', () => {
  it('shows no fault line when no rule needs fixing', () => {
    expect(needsFixingLine(0)).toBeNull()
  })
})

describe('the popup rule rows without usable rules', () => {
  it('lists nothing when the rules are missing or not a list', () => {
    expect(popupRuleRows(undefined, 'active')).toEqual([])
    expect(popupRuleRows('rules', 'inactive')).toEqual([])
  })

  it('leaves out rules set aside for fixing', () => {
    const rules = [{ name: 'broken', match: 'not a list', proxyId: 'tokyo' }]
    expect(popupRuleRows(rules, 'active')).toEqual([])
    expect(popupRuleRows(rules, 'inactive')).toEqual([])
  })
})

describe('the popup host without a usable URL', () => {
  it('has no host when the tab has no URL or it does not parse', () => {
    expect(hostForTabUrl(undefined)).toBeUndefined()
    expect(hostForTabUrl('not a url')).toBeUndefined()
  })
})

describe('the popup test result line when the test fails', () => {
  it('names the error instead of a proxy', () => {
    expect(popupTestResultLine({ success: false, proxy: '', error: 'Connection refused' } as any)).toBe('Failed: Connection refused')
  })
})
