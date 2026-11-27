import { proxyFormValues, ruleFormValues } from '@utils/editFields'

describe('the edit form reads a stored proxy', () => {
  it('reads each field of a proxy', () => {
    expect(proxyFormValues({
      id: 'p1', label: 'Office', type: 'socks', host: 'proxy.lan', port: 1080,
      username: 'u', password: 'x', notifyIfDown: true, proxyDNS: false,
    })).toEqual({
      label: 'Office', type: 'socks', host: 'proxy.lan', port: '1080',
      username: 'u', password: 'x', notifyIfDown: true,
    })
  })
})

describe('the edit form reads a stored rule', () => {
  it('joins list fields with commas and reads the active flag', () => {
    expect(ruleFormValues({
      name: 'Example', match: ['*://a.example/*', '*://b.example/*'], proxyId: 'p1',
      bypassResourceTypes: ['script'], active: false,
    })).toEqual({
      name: 'Example', match: '*://a.example/*, *://b.example/*', proxyId: 'p1',
      bypassUrlPatterns: '', bypassResourceTypes: 'script', staticExtensions: '',
      forceProxyUrlPatterns: '', fallbackDirect: false, active: false,
    })
  })
})
