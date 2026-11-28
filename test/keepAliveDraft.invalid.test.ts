import { keepAliveFormFaults, keepAliveRuleFaults, keepAliveStoredFaults } from '@utils/keepAliveDraft'

describe('keep-alive form faults for a rule that cannot be saved', () => {
  it('reports the proxy when none is chosen', () => {
    expect(keepAliveFormFaults({ proxyId: '', active: true, tabUrls: ['example.com'], testProxyUrl: '' }))
      .toEqual([{ field: 'proxyId', message: 'No proxy is chosen for this rule.' }])
  })

  it('reports the missing tab URL pattern', () => {
    expect(keepAliveFormFaults({ proxyId: 'good', active: true, tabUrls: [], testProxyUrl: '' }))
      .toEqual([{ field: 'tabUrls', message: 'Add at least one tab URL pattern.' }])
  })

  it('reports the row of a pattern that is not a host name', () => {
    expect(keepAliveFormFaults({ proxyId: 'good', active: true, tabUrls: ['example.com', 'bad domain.example'], testProxyUrl: '' }))
      .toEqual([{ field: 'tabUrls', message: 'Tab URL pattern 2 is not valid.', row: 1 }])
  })

  it('reports a test URL that is not http or https', () => {
    expect(keepAliveFormFaults({ proxyId: 'good', active: true, tabUrls: ['example.com'], testProxyUrl: 'ftp://probe.example/' }))
      .toEqual([{ field: 'testProxyUrl', message: 'Test URL must be an http or https address, or empty to use the default.' }])
  })

  it('reports every fault when the form is empty', () => {
    expect(keepAliveFormFaults({ proxyId: '', active: true, tabUrls: [], testProxyUrl: 'ftp://probe.example/' }).map(fault => fault.field))
      .toEqual(['proxyId', 'tabUrls', 'testProxyUrl'])
  })
})

describe('keep-alive rule faults for a stored rule', () => {
  it('reports a switch that is not on or off', () => {
    expect(keepAliveRuleFaults({ active: 'yes', tabUrls: ['example.com'] }))
      .toEqual([{ field: 'active', message: 'Choose on or off.' }])
  })

  it('reports a rule with no tab URL patterns and a switch that is not on or off', () => {
    expect(keepAliveStoredFaults('proxy-broken', { active: 'yes', tabUrls: [] }).map(fault => fault.field))
      .toEqual(['tabUrls', 'active'])
  })

  it('reports a stored test URL that is not http or https', () => {
    expect(keepAliveStoredFaults('good', { active: true, tabUrls: ['example.com'], testProxyUrl: 'ftp://probe.example/' }).map(fault => fault.field))
      .toEqual(['testProxyUrl'])
  })

  it('reports the missing patterns and switch for a rule with no fields', () => {
    expect(keepAliveRuleFaults({}).map(fault => fault.field)).toEqual(['tabUrls', 'active'])
  })
})
