import { canTestProxyId, planClearProxy, planSetProxy, ruleListWithActive } from '@utils/popupPlan'
import type { ProxyRule } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'

const TAB_TARGET = { scope: 'tab', tabId: 7, host: 'video.example.com' } as const
const SITE_TARGET = { scope: 'site', tabId: 7, host: 'video.example.com' } as const

function rule (name: string, extra: Partial<ProxyRule> = {}): ProxyRule {
  return { name, match: [`https://${name}.example/*`], proxyId: 'tokyo', ...extra } as ProxyRule
}

describe('setting a proxy from the popup', () => {
  it('sets the proxy on the tab when the tab scope is chosen', () => {
    expect(planSetProxy(TAB_TARGET, 'tokyo')).toEqual({ kind: 'setTabProxy', tabId: 7, proxyId: 'tokyo' })
  })

  it('sets the proxy on the site when the site scope is chosen', () => {
    expect(planSetProxy(SITE_TARGET, 'tokyo')).toEqual({ kind: 'setSiteProxy', host: 'video.example.com', proxyId: 'tokyo' })
  })

  it('sets Direct on the tab as a proxy id of its own', () => {
    expect(planSetProxy(TAB_TARGET, DIRECT_PROXY_ID)).toEqual({ kind: 'setTabProxy', tabId: 7, proxyId: DIRECT_PROXY_ID })
  })
})

describe('clearing a proxy from the popup', () => {
  it('clears the proxy on the tab when the tab scope is chosen', () => {
    expect(planClearProxy(TAB_TARGET)).toEqual({ kind: 'clearTabProxy', tabId: 7 })
  })

  it('clears the site override when the site scope is chosen', () => {
    expect(planClearProxy(SITE_TARGET)).toEqual({ kind: 'clearSiteProxy', host: 'video.example.com' })
  })
})

describe('the proxy test from the popup', () => {
  it('runs for a saved proxy and not for Direct', () => {
    expect(canTestProxyId('tokyo')).toBe(true)
    expect(canTestProxyId(DIRECT_PROXY_ID)).toBe(false)
  })
})

describe('toggling a rule in the popup', () => {
  it('returns the stored list with only the rule at that position changed', () => {
    const list = [rule('a'), rule('b', { active: false })]
    expect(ruleListWithActive(list, 1, true)).toEqual([rule('a'), rule('b', { active: true })])
  })
})
