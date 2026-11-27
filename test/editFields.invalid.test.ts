import { proxyFormValues, ruleFormValues } from '@utils/editFields'

describe('the edit form opens for a set aside proxy without throwing', () => {
  it.each([
    ['null', null],
    ['a string', 'set aside text'],
    ['an empty object', {}],
  ])('shows blank fields for %s', (_, entry) => {
    expect(proxyFormValues(entry)).toEqual({
      label: '', type: '', host: '', port: '', username: '', password: '', notifyIfDown: false,
    })
  })

  it('reads a partial proxy and leaves the missing fields blank', () => {
    expect(proxyFormValues({ id: 'p1', host: 'partial.lan' })).toEqual({
      label: '', type: '', host: 'partial.lan', port: '', username: '', password: '', notifyIfDown: false,
    })
  })
})

describe('the edit form opens for a set aside rule without throwing', () => {
  it.each([
    ['null', null],
    ['a string', 'set aside text'],
    ['an empty object', {}],
  ])('shows blank fields for %s', (_, entry) => {
    expect(ruleFormValues(entry)).toEqual({
      name: '', match: '', proxyId: '', bypassUrlPatterns: '', bypassResourceTypes: '',
      staticExtensions: '', forceProxyUrlPatterns: '', fallbackDirect: false, active: true,
    })
  })

  it('leaves out list entries that are not text', () => {
    expect(ruleFormValues({ match: ['*://a.example/*', 42, null] }).match).toBe('*://a.example/*')
  })
})
