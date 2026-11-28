import { KeepAliveRuleTakenError, keepAliveFormFaults, keepAliveFormOf, keepAliveMapAfterSave, keepAliveMapWithout, keepAliveRuleFaults, keepAliveStoredFaults, newKeepAliveForm } from '@utils/keepAliveDraft'

describe('a new keep-alive form', () => {
  it('starts with no proxy, no tab URL patterns, and Active on', () => {
    expect(newKeepAliveForm()).toEqual({ proxyId: '', active: true, tabUrls: [], testProxyUrl: '' })
  })
})

describe('keep-alive form faults for a rule that can be saved', () => {
  it('reports no fault for a chosen proxy, a host pattern, and an on or off choice', () => {
    expect(keepAliveFormFaults({ proxyId: 'good', active: true, tabUrls: ['example.com'], testProxyUrl: '' })).toEqual([])
  })

  it('reports no fault for a wildcard host pattern and an http test URL', () => {
    expect(keepAliveFormFaults({ proxyId: 'good', active: false, tabUrls: ['*.example.com'], testProxyUrl: 'http://probe.example/' })).toEqual([])
  })

  it('reports no fault for a stored rule that is complete', () => {
    expect(keepAliveStoredFaults('good', { active: true, tabUrls: ['example.com'] })).toEqual([])
  })
})

describe('reading a keep-alive rule into the form', () => {
  it('copies the stored fields into the form', () => {
    expect(keepAliveFormOf('good', { active: true, tabUrls: ['example.com', 'example.org'], testProxyUrl: 'https://probe.example/' }))
      .toEqual({ proxyId: 'good', active: true, tabUrls: ['example.com', 'example.org'], testProxyUrl: 'https://probe.example/' })
  })

  it('fills an absent rule with an inactive rule that has no patterns and no test URL', () => {
    expect(keepAliveFormOf('good', undefined)).toEqual({ proxyId: 'good', active: false, tabUrls: [], testProxyUrl: '' })
  })
})

describe('saving a keep-alive rule into the stored map', () => {
  it('adds a new rule at the end and keeps the others', () => {
    const map = { 'proxy-a': { active: true, tabUrls: ['a.example'] } }
    expect(keepAliveMapAfterSave(map, { proxyId: 'proxy-b', active: false, tabUrls: ['b.example'], testProxyUrl: '' }, undefined))
      .toEqual({ 'proxy-a': { active: true, tabUrls: ['a.example'] }, 'proxy-b': { active: false, tabUrls: ['b.example'] } })
  })

  it('moves an edited rule when its proxy changes and keeps unseen stored keys', () => {
    const map = { 'proxy-a': { active: true, tabUrls: ['a.example'], note: 'kept' } }
    expect(keepAliveMapAfterSave(map, { proxyId: 'proxy-b', active: true, tabUrls: ['b.example'], testProxyUrl: '' }, 'proxy-a'))
      .toEqual({ 'proxy-b': { active: true, tabUrls: ['b.example'], note: 'kept' } })
  })

  it('refuses to save a rule onto a proxy that another rule already uses', () => {
    const map = { 'proxy-a': { active: true, tabUrls: ['a.example'] }, 'proxy-b': { active: false, tabUrls: ['b.example'] } }
    expect(() => keepAliveMapAfterSave(map, { proxyId: 'proxy-b', active: true, tabUrls: ['c.example'], testProxyUrl: '' }, 'proxy-a'))
      .toThrow(KeepAliveRuleTakenError)
    expect(() => keepAliveMapAfterSave(map, { proxyId: 'proxy-a', active: true, tabUrls: ['c.example'], testProxyUrl: '' }, undefined))
      .toThrow(KeepAliveRuleTakenError)
  })

  it('stores the test URL only when one is given', () => {
    expect(keepAliveMapAfterSave({}, { proxyId: 'proxy-a', active: true, tabUrls: ['a.example'], testProxyUrl: 'https://probe.example/' }, undefined))
      .toEqual({ 'proxy-a': { active: true, tabUrls: ['a.example'], testProxyUrl: 'https://probe.example/' } })
  })
})

describe('removing keep-alive rules from the stored map', () => {
  it('drops only the listed proxies', () => {
    const map = { 'proxy-a': { active: true, tabUrls: ['a.example'] }, 'proxy-b': { active: false, tabUrls: [] }, 'proxy-c': { active: true, tabUrls: ['c.example'] } }
    expect(keepAliveMapWithout(map, ['proxy-a', 'proxy-c'])).toEqual({ 'proxy-b': { active: false, tabUrls: [] } })
  })
})

describe('keep-alive rule faults from stored fields', () => {
  it('reports no fault for a rule with a boolean switch and a valid pattern', () => {
    expect(keepAliveRuleFaults({ active: false, tabUrls: ['example.com'] })).toEqual([])
  })
})
