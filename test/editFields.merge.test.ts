import { mergeEditedFields, RULE_FORM_FIELDS } from '@utils/editFields'
import type { ProxyRule } from '@customTypes/proxy'

describe('an edited rule over its stored entry', () => {
  it('takes the edited form fields and keeps every stored field the form does not own', () => {
    const stored = {
      name: 'Old',
      match: ['https://a.example/*'],
      proxyId: 'p1',
      active: true,
      bypassUrlPatterns: ['https://a.example/skip/*'],
      proxyOnlyResourceTypes: ['image'],
      proxyOnlyPageHostnames: ['site.example'],
      fieldFromNewerVersion: 'kept',
    } as unknown as ProxyRule
    const edited = {
      name: 'New',
      match: ['https://a.example/*'],
      proxyId: 'p1',
      active: false,
    } as ProxyRule

    const merged = mergeEditedFields(stored, edited, RULE_FORM_FIELDS)

    expect(merged).toEqual({
      name: 'New',
      match: ['https://a.example/*'],
      proxyId: 'p1',
      active: false,
      proxyOnlyResourceTypes: ['image'],
      proxyOnlyPageHostnames: ['site.example'],
      fieldFromNewerVersion: 'kept',
    })
  })

  it('does not keep a form field the user cleared', () => {
    const stored = {
      name: 'r', match: ['https://a.example/*'], proxyId: 'p1', active: true,
      bypassResourceTypes: ['script'],
    } as ProxyRule
    const edited = { name: 'r', match: ['https://a.example/*'], proxyId: 'p1', active: true } as ProxyRule

    expect(mergeEditedFields(stored, edited, RULE_FORM_FIELDS)).not.toHaveProperty('bypassResourceTypes')
  })

  it('is the edited rule when there is no stored entry', () => {
    const edited = { name: 'new', match: ['https://a.example/*'], proxyId: 'p1', active: true } as ProxyRule

    expect(mergeEditedFields(undefined, edited, RULE_FORM_FIELDS)).toEqual(edited)
  })
})
