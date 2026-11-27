import { refuseConfigFile, refuseKeepAliveRules, refuseOverrides, refuseProxyItems, refuseRules } from '@utils/importFiles'

const proxy = { id: 'p1', type: 'socks', proxyDNS: true, host: 'proxy_1.lan', port: 1080 }
const rule = { active: true, name: 'Example', match: ['https://example.com/*'], proxyId: 'p1' }
const keepAlive = { active: true, tabUrls: ['*.example.com'] }

describe('an entry that would be set aside is refused by each path', () => {
  it('config file refuses a rule with a match pattern of "not a pattern" and keeps the valid rule', () => {
    const bad = { ...rule, name: 'Bad rule', match: ['not a pattern'] }

    const verdict = refuseConfigFile({ rules: [bad, rule] })

    expect(verdict.accepted.rules).toEqual([rule])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('Bad rule')
    expect(verdict.messages[0]).toContain('not a pattern')
  })

  it('rules import refuses a rule with a match pattern of "not a pattern" and keeps the valid rule', () => {
    const bad = { ...rule, name: 'Bad rule', match: ['not a pattern'] }

    const verdict = refuseRules([bad, rule])

    expect(verdict.accepted).toEqual([rule])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('Bad rule')
    expect(verdict.messages[0]).toContain('not a pattern')
  })

  it.each([
    ['a host with a semicolon and a second proxy', { ...proxy, host: 'a:1; PROXY x:8080' }],
    ['a whitespace only host', { ...proxy, host: '   ' }],
    ['a port of 70000', { ...proxy, port: 70000 }],
  ])('config file refuses a proxy with %s', (_, bad) => {
    const verdict = refuseConfigFile({ proxyList: [bad, proxy] })

    expect(verdict.accepted.proxyList).toEqual([proxy])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain(String(bad.host))
  })

  it.each([
    ['a host with a semicolon and a second proxy', { ...proxy, host: 'a:1; PROXY x:8080' }],
    ['a whitespace only host', { ...proxy, host: '   ' }],
    ['a port of 70000', { ...proxy, port: 70000 }],
  ])('proxies import refuses a proxy with %s', (_, bad) => {
    const verdict = refuseProxyItems([bad, proxy])

    expect(verdict.accepted).toEqual([proxy])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain(String(bad.host))
  })

  it('config file skips a test URL of www.google.com and imports the rest of the file', () => {
    const verdict = refuseConfigFile({ testProxyUrl: 'www.google.com', rules: [rule] })

    expect(verdict.accepted).not.toHaveProperty('testProxyUrl')
    expect(verdict.accepted.rules).toEqual([rule])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('www.google.com')
  })

  it('overrides import refuses a domain that is not valid and keeps the valid one', () => {
    const verdict = refuseOverrides({ 'exa mple.com': 'p1', 'example.com': 'p1' })

    expect(verdict.accepted).toEqual({ 'example.com': 'p1' })
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('exa mple.com')
  })

  it('keep-alive import refuses a rule with a tab URL that is not valid and keeps the valid one', () => {
    const bad = { active: true, tabUrls: ['not valid!'] }

    const verdict = refuseKeepAliveRules({ p2: bad, p1: keepAlive })

    expect(verdict.accepted).toEqual({ p1: keepAlive })
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('p2')
  })

  it('config file refuses a keep-alive rule with a tab URL that is not valid', () => {
    const verdict = refuseConfigFile({ keepAliveRules: { p2: { active: true, tabUrls: ['not valid!'] } } })

    expect(verdict.accepted.keepAliveRules).toEqual({})
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('p2')
  })
})

describe('a staticExtensions value that is not valid is kept and its setting ignored', () => {
  it.each([
    ['/(/'],
    ['/x/gg'],
    ['\\.(png|css)$'],
  ])('config file imports a rule with staticExtensions %s as written and names the rule', (value) => {
    const withExtensions = { ...rule, name: 'Images', staticExtensions: value }

    const verdict = refuseConfigFile({ rules: [withExtensions] })

    expect(verdict.accepted.rules).toEqual([withExtensions])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('Images')
    expect(verdict.messages[0]).toContain('ignored')
  })

  it.each([
    ['/(/'],
    ['/x/gg'],
    ['\\.(png|css)$'],
  ])('rules import keeps a rule with staticExtensions %s as written and names the rule', (value) => {
    const withExtensions = { ...rule, name: 'Images', staticExtensions: value }

    const verdict = refuseRules([withExtensions])

    expect(verdict.accepted).toEqual([withExtensions])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('Images')
    expect(verdict.messages[0]).toContain('ignored')
  })
})

describe('a whole section of the wrong shape is refused with a message', () => {
  it('config file that is not an object imports nothing', () => {
    const verdict = refuseConfigFile(['not', 'an', 'object'])

    expect(verdict.accepted).toEqual({})
    expect(verdict.messages).toHaveLength(1)
  })

  it('rules import that is not a list imports nothing', () => {
    const verdict = refuseRules('oops')

    expect(verdict.accepted).toEqual([])
    expect(verdict.messages).toHaveLength(1)
  })
})
