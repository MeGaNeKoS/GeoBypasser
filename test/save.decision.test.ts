import {
  canSaveDefaultProxy,
  canSaveKeepAliveRule,
  canSaveOverride,
  canSaveProxy,
  canSaveRuleForm,
  canSaveTestUrl,
  canToggleRule,
} from '@utils/saveDecisions'

const proxy = { id: 'p1', type: 'socks', proxyDNS: true, host: 'proxy_1.lan', port: 1080 }
const rule = { active: true, name: 'Example', match: ['https://example.com/*'], proxyId: 'p1' }

describe('proxy form', () => {
  it('saves a proxy with a valid id, type, host, and port', () => {
    expect(canSaveProxy(proxy)).toBe(true)
  })

  it('saves a proxy whose host has surrounding spaces', () => {
    expect(canSaveProxy({ ...proxy, host: '  proxy_1.lan ' })).toBe(true)
  })
})

describe('diagnostics add proxy path', () => {
  it('saves a proxy built from the diagnostics inputs once the modal gives it an id', () => {
    expect(canSaveProxy({ ...proxy, id: 'generated-id', host: 'diag.lan', port: 3128 })).toBe(true)
  })
})

describe('rule form', () => {
  it('saves a rule with a valid match pattern and proxy', () => {
    expect(canSaveRuleForm(rule)).toBe(true)
  })

  it('saves a rule whose staticExtensions value is valid', () => {
    expect(canSaveRuleForm({ ...rule, staticExtensions: '/\\.(png|css)$/i' })).toBe(true)
  })

  it('saves a rule with no staticExtensions value', () => {
    expect(canSaveRuleForm({ ...rule, staticExtensions: undefined })).toBe(true)
  })
})

describe('website override form', () => {
  it('saves a valid domain with a proxy id', () => {
    expect(canSaveOverride('example.com', 'p1')).toBe(true)
  })
})

describe('keep-alive form', () => {
  it('saves a keep-alive rule with a valid tab URL pattern and test URL', () => {
    expect(canSaveKeepAliveRule({ active: true, tabUrls: ['*.example.com'], testProxyUrl: 'https://www.google.com/' })).toBe(true)
  })

  it('saves a keep-alive rule with no test URL', () => {
    expect(canSaveKeepAliveRule({ active: true, tabUrls: ['*.example.com'] })).toBe(true)
  })
})

describe('general settings form', () => {
  it('saves an http or https test URL', () => {
    expect(canSaveTestUrl('https://www.google.com')).toBe(true)
  })

  it('saves the empty default proxy as None', () => {
    expect(canSaveDefaultProxy('', [proxy])).toBe(true)
  })

  it('saves a default proxy that is one of the usable proxies', () => {
    expect(canSaveDefaultProxy('p1', [proxy])).toBe(true)
  })
})

describe('popup', () => {
  it('saves an override for a host and a proxy id', () => {
    expect(canSaveOverride('example.com', 'direct')).toBe(true)
  })

  it('saves a rule toggle for a valid rule', () => {
    expect(canToggleRule(rule)).toBe(true)
  })
})
