import {
  canSaveDefaultProxy,
  canSaveKeepAliveRule,
  canSaveOverride,
  canSaveProxy,
  canSaveRuleForm,
  canSaveTestUrl,
  canToggleRule,
  proxyFieldsAtFault,
} from '@utils/saveDecisions'

const proxy = { id: 'p1', type: 'socks', proxyDNS: true, host: 'proxy_1.lan', port: 1080 }
const rule = { active: true, name: 'Example', match: ['https://example.com/*'], proxyId: 'p1' }

describe('proxy form fields at fault', () => {
  it('marks only the port when the port is out of range', () => {
    expect(proxyFieldsAtFault({ ...proxy, port: 70000 })).toEqual({ type: false, host: false, port: true })
  })

  it('marks the type when the type is not supported', () => {
    expect(proxyFieldsAtFault({ ...proxy, type: 'ftp' })).toEqual({ type: true, host: false, port: false })
  })

  it('marks the host when the host is blank', () => {
    expect(proxyFieldsAtFault({ ...proxy, host: '   ' })).toEqual({ type: false, host: true, port: false })
  })
})

describe('proxy form', () => {
  it('refuses a host that contains a semicolon and a space', () => {
    expect(canSaveProxy({ ...proxy, host: 'a:1; PROXY x:8080' })).toBe(false)
  })

  it('refuses a host that is only whitespace', () => {
    expect(canSaveProxy({ ...proxy, host: '   ' })).toBe(false)
  })

  it('refuses a port of 70000', () => {
    expect(canSaveProxy({ ...proxy, port: 70000 })).toBe(false)
  })

  it('refuses a proxy with an unsupported type', () => {
    expect(canSaveProxy({ ...proxy, type: 'ftp' })).toBe(false)
  })
})

describe('diagnostics add proxy path', () => {
  it('refuses a diagnostics proxy whose host is not valid', () => {
    expect(canSaveProxy({ id: 'generated-id', type: 'http', proxyDNS: true, host: 'a b.lan', port: 3128 })).toBe(false)
  })
})

describe('rule form', () => {
  it('refuses a rule whose match pattern is not valid', () => {
    expect(canSaveRuleForm({ ...rule, match: ['not a pattern'] })).toBe(false)
  })

  it('refuses a rule with no name', () => {
    expect(canSaveRuleForm({ ...rule, name: '' })).toBe(false)
  })

  it('refuses a rule with no proxy', () => {
    expect(canSaveRuleForm({ ...rule, proxyId: '' })).toBe(false)
  })

  it('refuses a rule whose staticExtensions value compiles but repeats a flag', () => {
    expect(canSaveRuleForm({ ...rule, staticExtensions: '/x/gg' })).toBe(false)
  })

  it('refuses a rule whose staticExtensions value does not compile', () => {
    expect(canSaveRuleForm({ ...rule, staticExtensions: '/(/' })).toBe(false)
  })
})

describe('website override form', () => {
  it('refuses a domain that contains a space', () => {
    expect(canSaveOverride('exa mple.com', 'p1')).toBe(false)
  })

  it('refuses an override with no proxy id', () => {
    expect(canSaveOverride('example.com', '')).toBe(false)
  })
})

describe('keep-alive form', () => {
  it('refuses a tab URL pattern that is not valid', () => {
    expect(canSaveKeepAliveRule({ active: true, tabUrls: ['not valid!'] })).toBe(false)
  })

  it('refuses a keep-alive test URL that is not an absolute http or https URL', () => {
    expect(canSaveKeepAliveRule({ active: true, tabUrls: ['*.example.com'], testProxyUrl: 'www.google.com' })).toBe(false)
  })
})

describe('general settings form', () => {
  it('refuses a test URL that is not an absolute http or https URL', () => {
    expect(canSaveTestUrl('www.google.com')).toBe(false)
  })

  it('refuses a default proxy that is not one of the usable proxies', () => {
    expect(canSaveDefaultProxy('gone', [proxy])).toBe(false)
  })
})

describe('popup', () => {
  it('refuses an override for a domain that is not valid', () => {
    expect(canSaveOverride('exa mple.com', 'direct')).toBe(false)
  })

  it('refuses a rule toggle for a rule whose match pattern is not valid', () => {
    expect(canToggleRule({ ...rule, match: ['not a pattern'] })).toBe(false)
  })

  it('saves a rule toggle for a rule whose staticExtensions value is not valid', () => {
    expect(canToggleRule({ ...rule, staticExtensions: '/x/gg' })).toBe(true)
  })
})
