import type { ProxyRule } from '@customTypes/proxy'
import type { RequestLogRow, RouteLine } from '@utils/requestLog'
import { ruleFormForSelection, skippableRuleOf } from '@utils/requestLogRule'
import { ruleFormOf } from '@utils/ruleDraft'

const PAGE = 'page.example'
const HOST = 'cdn.example.com'

function ruleRoute (ruleId: number, ruleName: string): RouteLine {
  return { label: `Proxy by rule "${ruleName}"`, reason: 'rule', count: 1, bytes: 0, expected: false, proxied: true, ruleId, ruleName }
}

function rowRoutedBy (route: RouteLine): RequestLogRow {
  return { page: PAGE, host: HOST, requests: 1, types: [], results: [], routes: [route], sentBytes: 0, receivedBytes: 0, unsizedCount: 0, paths: {} }
}

function ruleNamed (name: string): ProxyRule {
  return { name } as ProxyRule
}

describe('skipping a host in a request log row, negative cases', () => {
  it('refuses when the rule at the recorded index now has another name', () => {
    expect(skippableRuleOf(rowRoutedBy(ruleRoute(0, 'cdn')), [ruleNamed('renamed')])).toBeUndefined()
  })

  it('refuses when the recorded index no longer exists', () => {
    expect(skippableRuleOf(rowRoutedBy(ruleRoute(3, 'cdn')), [ruleNamed('cdn')])).toBeUndefined()
  })

  it('refuses a route that no rule chose', () => {
    const defaultRoute: RouteLine = { label: 'Proxy by default proxy', reason: 'default', count: 1, bytes: 0, expected: false, proxied: true }

    expect(skippableRuleOf(rowRoutedBy(defaultRoute), [ruleNamed('cdn')])).toBeUndefined()
  })
})

describe('rule from a request log selection, negative cases', () => {
  it('leaves the types out on Chrome, which cannot match by type', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: [HOST], types: [{ host: HOST, type: 'script' }] }, false)

    expect(form).toEqual({ ...ruleFormOf(), name: PAGE, match: [`*://${HOST}/*`] })
  })

  it('drops a logged type the rule form does not know', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: [HOST], types: [{ host: HOST, type: 'telemetry' }] }, true)

    expect(form.resourceTypeMode).toBe('never')
    expect(form.onlyResourceTypes).toEqual([])
    expect(form.proxyOnlyPageHostnames).toEqual([PAGE])
  })

  it('creates no match and keeps the page name when no host is selected', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: [], types: [] }, true)

    expect(form.match).toEqual([])
    expect(form.name).toBe(PAGE)
  })
})

describe('no skip is offered for a host the rule already never proxies', () => {
  it('offers no skip when the rule bypass list already names the host', () => {
    const rule = { name: 'cdn', bypassUrlPatterns: [`*://${HOST}/*`] } as ProxyRule

    expect(skippableRuleOf(rowRoutedBy(ruleRoute(0, 'cdn')), [rule])).toBeUndefined()
  })
})
