import { planClearProxy, planSetProxy, ruleListWithActive } from '@utils/popupPlan'
import type { ProxyRule } from '@customTypes/proxy'

const NO_CHANGE = { kind: 'none' }

describe('setting a proxy with nothing to attach it to', () => {
  it('changes nothing on the tab scope without a tab id', () => {
    expect(planSetProxy({ scope: 'tab', tabId: undefined, host: 'a.example' }, 'tokyo')).toEqual(NO_CHANGE)
  })

  it('changes nothing on the site scope without a host', () => {
    expect(planSetProxy({ scope: 'site', tabId: 7, host: undefined }, 'tokyo')).toEqual(NO_CHANGE)
  })

  it('changes nothing on the site scope when the host cannot take an override', () => {
    expect(planSetProxy({ scope: 'site', tabId: 7, host: 'not a host' }, 'tokyo')).toEqual(NO_CHANGE)
  })
})

describe('clearing a proxy with nothing to clear it from', () => {
  it('changes nothing on the tab scope without a tab id', () => {
    expect(planClearProxy({ scope: 'tab', tabId: undefined, host: 'a.example' })).toEqual(NO_CHANGE)
  })

  it('changes nothing on the site scope without a host', () => {
    expect(planClearProxy({ scope: 'site', tabId: 7, host: undefined })).toEqual(NO_CHANGE)
  })
})

describe('toggling a rule that cannot be saved', () => {
  it('returns no list for a stored entry that is not a rule', () => {
    const list = [{ name: 'broken', match: 'not a list', proxyId: 'tokyo' }] as unknown as ProxyRule[]
    expect(ruleListWithActive(list, 0, true)).toBeUndefined()
  })

  it('returns no list for a position past the end of the stored list', () => {
    expect(ruleListWithActive([], 3, true)).toBeUndefined()
  })
})
