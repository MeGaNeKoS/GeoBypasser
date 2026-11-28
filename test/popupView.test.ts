import {
  canTestFromPopup,
  defaultPopupScope,
  emptyRuleListText,
  needsFixingLine,
  popupRuleSummary,
  popupScopeOptions,
  popupUsingLine,
} from '@utils/popupView'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const tokyo: ProxyListItem = { id: 'tokyo', type: 'socks', host: 'tokyo.lan', port: 1080, proxyDNS: true, label: 'Tokyo SOCKS' } as any
const bare: ProxyListItem = { id: 'bare', type: 'http', host: 'bare.lan', port: 8080, proxyDNS: false } as any

function rule (name: string, extra: Partial<ProxyRule> = {}): ProxyRule {
  return { name, match: [`https://${name}.example/*`], proxyId: 'tokyo', ...extra } as ProxyRule
}

describe('popup scope on each browser', () => {
  it('preselects the tab scope where tabs can have their own proxy', () => {
    expect(defaultPopupScope(true)).toBe('tab')
  })

  it('preselects the site scope where tabs cannot have their own proxy', () => {
    expect(defaultPopupScope(false)).toBe('site')
  })

  it('enables the tab scope only where tabs can have their own proxy', () => {
    expect(popupScopeOptions(true)).toEqual([
      { scope: 'tab', enabled: true },
      { scope: 'site', enabled: true },
    ])
    expect(popupScopeOptions(false)).toEqual([
      { scope: 'tab', enabled: false },
      { scope: 'site', enabled: true },
    ])
  })

  it('offers Test proxy only where tabs can have their own proxy', () => {
    expect(canTestFromPopup(true)).toBe(true)
    expect(canTestFromPopup(false)).toBe(false)
  })
})

describe('the Using line in the This tab block', () => {
  it('names the proxy and the scope it is set for', () => {
    expect(popupUsingLine({ scope: 'tab', proxyId: 'tokyo', proxyList: [tokyo], notInEffect: false }))
      .toBe('Using: Tokyo SOCKS (set for this tab)')
  })

  it('falls back to the host when a proxy has no label', () => {
    expect(popupUsingLine({ scope: 'site', proxyId: 'bare', proxyList: [bare], notInEffect: false }))
      .toBe('Using: bare.lan (set for this site)')
  })

  it('reads Direct for the direct choice without a stored proxy', () => {
    expect(popupUsingLine({ scope: 'site', proxyId: 'direct', proxyList: [], notInEffect: false }))
      .toBe('Using: Direct (set for this site)')
  })

  it('says the setting is saved but not in effect when control is elsewhere', () => {
    expect(popupUsingLine({ scope: 'site', proxyId: 'tokyo', proxyList: [tokyo], notInEffect: true }))
      .toBe('Saved, not in effect: Tokyo SOCKS (set for this site)')
  })
})

describe('the popup rule summary', () => {
  it('counts active and inactive usable rules and the total stored', () => {
    const rules = compileRules([rule('a'), rule('b', { active: false }), rule('c')])
    expect(popupRuleSummary(rules)).toEqual({ total: 3, needsFixing: 0, active: 2, inactive: 1 })
  })

  it('counts rules set aside for fixing without listing them as usable', () => {
    const rules = compileRules([rule('a'), { name: 'broken', match: 'not a list', proxyId: 'tokyo' }])
    expect(popupRuleSummary(rules)).toEqual({ total: 2, needsFixing: 1, active: 1, inactive: 0 })
  })
})

describe('the popup rule list text', () => {
  it('names the empty active and inactive lists', () => {
    expect(emptyRuleListText('active')).toBe('No active rules')
    expect(emptyRuleListText('inactive')).toBe('No inactive rules')
  })

  it('says how many rules need fixing, in the singular and the plural', () => {
    expect(needsFixingLine(1)).toBe('1 rule needs fixing.')
    expect(needsFixingLine(3)).toBe('3 rules need fixing.')
  })
})
