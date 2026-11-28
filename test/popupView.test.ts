import {
  canTestFromPopup,
  chromeSiteNote,
  defaultPopupScope,
  emptyRuleListText,
  hostForTabUrl,
  monitorHintFor,
  needsFixingLine,
  popupControlWarning,
  popupRuleRows,
  popupRuleSummary,
  popupScopeOptions,
  popupTestResultLine,
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
  it('names the tab proxy as the one the tab uses', () => {
    expect(popupUsingLine({ scope: 'tab', tabProxyId: 'tokyo', siteProxyId: undefined, proxyList: [tokyo], notInEffect: false }))
      .toBe('Using: Tokyo SOCKS (set for this tab)')
  })

  it('names the site proxy when the tab has none of its own', () => {
    expect(popupUsingLine({ scope: 'tab', tabProxyId: undefined, siteProxyId: 'bare', proxyList: [bare], notInEffect: false }))
      .toBe('Using: bare.lan (set for this site)')
  })

  it('prefers the tab proxy over the site proxy', () => {
    expect(popupUsingLine({ scope: 'site', tabProxyId: 'tokyo', siteProxyId: 'bare', proxyList: [tokyo, bare], notInEffect: false }))
      .toBe('Using: Tokyo SOCKS (set for this tab)')
  })

  it('reads Direct for the direct choice without a stored proxy', () => {
    expect(popupUsingLine({ scope: 'site', tabProxyId: undefined, siteProxyId: 'direct', proxyList: [], notInEffect: false }))
      .toBe('Using: Direct (set for this site)')
  })

  it('says the setting is saved but not in effect when control is elsewhere', () => {
    expect(popupUsingLine({ scope: 'site', tabProxyId: undefined, siteProxyId: 'tokyo', proxyList: [tokyo], notInEffect: true }))
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

describe('the popup rule list rows', () => {
  it('lists each usable rule in the filter with its position in the stored list', () => {
    const rules = compileRules([rule('a'), rule('b', { active: false }), rule('c')])
    expect(popupRuleRows(rules, 'active')).toEqual([
      { position: 0, name: 'a', active: true },
      { position: 2, name: 'c', active: true },
    ])
    expect(popupRuleRows(rules, 'inactive')).toEqual([{ position: 1, name: 'b', active: false }])
  })
})

describe('the popup host', () => {
  it('reads the hostname of the tab URL', () => {
    expect(hostForTabUrl('https://video.example.com/watch?v=1')).toBe('video.example.com')
  })
})

describe('the popup rule list text', () => {
  const populated = { total: 3, needsFixing: 0, active: 0, inactive: 3 }

  it('names the empty active and inactive lists', () => {
    expect(emptyRuleListText(populated, 'active')).toBe('No active rules')
    expect(emptyRuleListText(populated, 'inactive')).toBe('No inactive rules')
  })

  it('invites the user to the dashboard when there are no rules at all', () => {
    const none = { total: 0, needsFixing: 0, active: 0, inactive: 0 }
    expect(emptyRuleListText(none, 'active')).toBe('No rules yet. Open dashboard')
  })

  it('says how many rules need fixing, in the singular and the plural', () => {
    expect(needsFixingLine(1)).toBe('1 rule needs fixing.')
    expect(needsFixingLine(3)).toBe('3 rules need fixing.')
  })
})

describe('popup copy for control, tests, and Chrome', () => {
  it('offers the extensions page only when another extension is the cause', () => {
    expect(popupControlWarning('overridden')).toEqual({
      message: 'GeoBypass is not routing. Another extension controls proxy settings. Turn it off or remove it.',
      actionLabel: 'Open extensions page',
    })
    expect(popupControlWarning('unavailable')).toEqual({
      message: 'GeoBypass is not routing. A browser policy controls proxy settings. GeoBypass cannot change it.',
    })
  })

  it('names the proxy a successful test connected through', () => {
    expect(popupTestResultLine({ success: true, proxy: '203.0.113.7:1080' } as any)).toBe('Connected through 203.0.113.7:1080')
  })

  it('names the domain in the Chrome site note', () => {
    expect(chromeSiteNote('video.example.com')).toContain('requests to video.example.com and its subdomains')
  })

  it('asks for DevTools to stay open only where monitoring needs it', () => {
    expect(monitorHintFor(false)).toBe('Keep DevTools open while monitoring.')
    expect(monitorHintFor(true)).toBeUndefined()
  })
})
