import { proxyReasons } from '@utils/setAsideReasons'

const badPortProxy = { id: 'london', type: 'http', host: 'london.lan', port: 70000, proxyDNS: false, label: 'London' }

describe('proxy set aside reasons name the field that is wrong', () => {
  it('states the port rule in full', () => {
    expect(proxyReasons(badPortProxy)).toEqual(['Port is not a number from 1 to 65535.'])
  })

  it('gives the failover note for an invalid failover timeout', () => {
    expect(proxyReasons({ ...badPortProxy, port: 8080, failoverTimeout: 0 }))
      .toEqual(['Failover timeout is not a whole number of seconds, 1 or more, so the default is used.'])
  })

  it('gives no reason for a valid failover timeout', () => {
    expect(proxyReasons({ ...badPortProxy, port: 8080, failoverTimeout: 30 })).toEqual([])
  })
})
