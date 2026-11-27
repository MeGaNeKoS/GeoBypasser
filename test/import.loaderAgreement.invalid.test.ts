import { refuseProxyItems } from '@utils/importFiles'
import { usableProxies } from '@utils/usable'

const proxy = { id: 'p1', type: 'socks', proxyDNS: true, host: 'proxy_1.lan', port: 1080 }

describe('a proxy needs an id and a supported type', () => {
  it('the loader drops a proxy without an id', () => {
    expect(usableProxies([{ ...proxy, id: '' }])).toEqual([])
  })

  it('the loader drops a proxy whose type is not supported', () => {
    expect(usableProxies([{ ...proxy, type: 'ftp' }])).toEqual([])
  })

  it('the import refuses a proxy without an id and names it', () => {
    const verdict = refuseProxyItems([{ ...proxy, id: '' }])

    expect(verdict.accepted).toEqual([])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('it has no id')
  })

  it('the import refuses a proxy whose type is not supported and names it', () => {
    const verdict = refuseProxyItems([{ ...proxy, type: 'ftp' }])

    expect(verdict.accepted).toEqual([])
    expect(verdict.messages).toHaveLength(1)
    expect(verdict.messages[0]).toContain('socks or http')
  })
})
