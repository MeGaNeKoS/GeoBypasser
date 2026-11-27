import { generatePacScript } from '@utils/pac'
import { makeProxyHandler } from '@utils/proxy'
import { popupRules, ruleRows } from '@utils/pageView'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const good: ProxyListItem = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false } as any
const fallback: ProxyListItem = { id: 'fallback', type: 'http', host: 'fallback.lan', port: 8081, proxyDNS: false } as any

const inactiveRule: any = { active: false, name: 'off', match: ['https://example.com/*'], proxyId: 'good' }

function config (rules: unknown[]): any {
  return {
    proxyList: [good, fallback],
    defaultProxy: 'fallback',
    fallbackDirect: false,
    testProxyUrl: 'https://www.google.com/',
    rules: compileRules(rules as ProxyRule[]),
    perWebsiteOverride: {},
    keepAliveRules: {},
  }
}

describe('a rule with active set to false is inactive', () => {
  it('the PAC script has no line for its pattern', () => {
    const pac = generatePacScript(config([inactiveRule]))
    expect(pac).not.toContain('https://example.com/*')
    expect(pac).not.toContain('good.lan')
  })

  it('the Firefox handler does not route its pattern to its proxy', async () => {
    const handler = makeProxyHandler(config([inactiveRule]))
    const res = await handler({ url: 'https://example.com/a', type: 'main_frame', tabId: -1 } as any)
    expect(res).not.toEqual([expect.objectContaining({ host: 'good.lan' })])
  })

  it('the dashboard row shows it as inactive', () => {
    const [row] = ruleRows([inactiveRule], [good])
    expect(row.active).toBe(false)
  })

  it('the popup inactive list contains it and the active list does not', () => {
    const rules = [inactiveRule]
    expect(popupRules(rules, false).map(r => r.name)).toEqual(['off'])
    expect(popupRules(rules, true)).toEqual([])
  })
})
