import { isFailoverTimeoutText, proxyFormFaults, proxyFormOf } from '@utils/proxyDraft'

const valid = proxyFormOf({ id: 'p1', type: 'http', host: 'h.lan', port: 8080, proxyDNS: true })

function faultFields (form: Parameters<typeof proxyFormFaults>[0]): string[] {
  return proxyFormFaults(form).map(fault => fault.field)
}

describe('proxy form faults', () => {
  it('reports nothing for a valid form', () => {
    expect(proxyFormFaults(valid)).toEqual([])
  })

  it('reports the host when it is blank', () => {
    expect(faultFields({ ...valid, host: '  ' })).toEqual(['host'])
  })

  it('reports the port when it is out of range or not a number', () => {
    expect(faultFields({ ...valid, port: '70000' })).toEqual(['port'])
    expect(faultFields({ ...valid, port: 'abc' })).toEqual(['port'])
  })

  it('reports the type when it is not a proxy type', () => {
    expect(faultFields({ ...valid, type: 'ftp' })).toEqual(['type'])
  })

  it('reports a failover timeout that is not a whole number of seconds from 1', () => {
    expect(faultFields({ ...valid, failoverTimeout: '0' })).toEqual(['failoverTimeout'])
    expect(faultFields({ ...valid, failoverTimeout: '1.5' })).toEqual(['failoverTimeout'])
    expect(faultFields({ ...valid, failoverTimeout: '-3' })).toEqual(['failoverTimeout'])
  })

  it('accepts an empty or whole failover timeout', () => {
    expect(isFailoverTimeoutText('')).toBe(true)
    expect(isFailoverTimeoutText(' 12 ')).toBe(true)
  })
})
