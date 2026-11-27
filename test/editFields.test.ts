import { proxyFormValues } from '@utils/editFields'

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
