import { generatePacScript } from '@utils/pac'
import { matchPatternSource } from '@utils/pacPattern'
import { makeProxyHandler } from '@utils/proxy'
import { popupRules, ruleRows } from '@utils/pageView'
import { compileRules } from '@utils/storage'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'

const good: ProxyListItem = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false } as any
const fallback: ProxyListItem = { id: 'fallback', type: 'http', host: 'fallback.lan', port: 8081, proxyDNS: false } as any

const ruleWithoutActive: any = { name: 'no flag', match: ['https://example.com/*'], proxyId: 'good' }

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

describe('a rule without an active field is active', () => {
  it('the PAC script routes its pattern to its proxy', () => {
    const pac = generatePacScript(config([ruleWithoutActive]))
    expect(pac).toContain(`new RegExp(${JSON.stringify(matchPatternSource('https://example.com/*'))}).test(url)`)
    expect(pac).toContain('good.lan')
  })

  it('the Firefox handler routes a matching request to its proxy', async () => {
    const handler = makeProxyHandler(config([ruleWithoutActive]))
    const res = await handler({ url: 'https://example.com/a', type: 'main_frame', tabId: -1 } as any)
    expect(res).toEqual([expect.objectContaining({ host: 'good.lan' })])
  })

  it('the dashboard row shows it as active', () => {
    const [row] = ruleRows([ruleWithoutActive], [good])
    expect(row.active).toBe(true)
  })

  it('the popup active list contains it and the inactive list does not', () => {
    const rules = [ruleWithoutActive]
    expect(popupRules(rules, true).map(r => r.name)).toEqual(['no flag'])
    expect(popupRules(rules, false)).toEqual([])
  })
})
