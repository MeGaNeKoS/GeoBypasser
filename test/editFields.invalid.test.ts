import { proxyFormValues } from '@utils/editFields'

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
