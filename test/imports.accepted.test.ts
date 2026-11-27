import { refuseConfigFile, refuseKeepAliveRules, refuseOverrides, refuseProxyItems, refuseRules } from '@utils/importFiles'

const proxy = { id: 'p1', type: 'socks', proxyDNS: true, host: 'proxy_1.lan', port: 1080 }
const rule = { active: true, name: 'Example', match: ['https://example.com/*'], proxyId: 'p1' }
const keepAlive = { active: true, tabUrls: ['*.example.com'], testProxyUrl: 'https://www.google.com/' }

describe('valid entries from each import path', () => {
  it('config file imports every section as written', () => {
    const file = {
      proxyList: [proxy],
      defaultProxy: 'p1',
      fallbackDirect: false,
      testProxyUrl: 'https://www.google.com',
      rules: [rule],
      keepAliveRules: { p1: keepAlive },
      perWebsiteOverride: { 'example.com': 'p1' },
    }

    const verdict = refuseConfigFile(file)

    expect(verdict.messages).toEqual([])
    expect(verdict.accepted).toEqual(file)
  })

  it('rules import accepts a rule with a valid staticExtensions value without a message', () => {
    const withExtensions = { ...rule, staticExtensions: '/\\.(png|css)$/i' }

    const verdict = refuseRules([withExtensions])

    expect(verdict.messages).toEqual([])
    expect(verdict.accepted).toEqual([withExtensions])
  })

  it('proxies import accepts a host with surrounding spaces and stores it as written', () => {
    const padded = { ...proxy, host: '  proxy_1.lan ' }

    const verdict = refuseProxyItems([padded])

    expect(verdict.messages).toEqual([])
    expect(verdict.accepted).toEqual([padded])
  })

  it('overrides import accepts a valid domain and proxy id', () => {
    const verdict = refuseOverrides({ 'example.com': 'p1' })

    expect(verdict.messages).toEqual([])
    expect(verdict.accepted).toEqual({ 'example.com': 'p1' })
  })

  it('keep-alive import accepts a rule with a valid test URL', () => {
    const verdict = refuseKeepAliveRules({ p1: keepAlive })

    expect(verdict.messages).toEqual([])
    expect(verdict.accepted).toEqual({ p1: keepAlive })
  })
})

describe('a rule without an active field is imported as written', () => {
  it('rules import keeps the rule without adding an active field', () => {
    const withoutActive = { name: 'Example', match: ['https://example.com/*'], proxyId: 'p1' }

    const verdict = refuseRules([withoutActive])

    expect(verdict.messages).toEqual([])
    expect(verdict.accepted).toEqual([withoutActive])
    expect('active' in verdict.accepted[0]).toBe(false)
  })
})

describe('an imported entry keeps fields this version does not know', () => {
  it('rule keeps an unknown field as written', () => {
    const newer = { ...rule, futureField: { level: 2 } }

    const verdict = refuseRules([newer])

    expect(verdict.accepted[0]).toEqual(newer)
  })

  it('config file rule keeps an unknown field as written', () => {
    const newer = { ...rule, futureField: 'kept' }

    const verdict = refuseConfigFile({ rules: [newer] })

    expect(verdict.accepted.rules).toEqual([newer])
  })

  it('proxy keeps an unknown field as written', () => {
    const newer = { ...proxy, futureField: true }

    const verdict = refuseProxyItems([newer])

    expect(verdict.accepted).toEqual([newer])
  })
})
