import { siteFormFaults } from '@utils/siteDraft'

describe('site draft faults for a site that cannot be saved', () => {
  it('reports the domain when it is not a host name', () => {
    expect(siteFormFaults({ domain: 'bad domain.example', proxyId: 'good' }))
      .toEqual([{ field: 'domain', message: 'Domain is not a valid host name, such as example.com.' }])
  })

  it('reports the proxy when none is chosen', () => {
    expect(siteFormFaults({ domain: 'example.com', proxyId: '' }))
      .toEqual([{ field: 'proxyId', message: 'No proxy is chosen for this site.' }])
  })

  it('reports both faults when neither field is valid', () => {
    expect(siteFormFaults({ domain: '', proxyId: '' }).map(fault => fault.field)).toEqual(['domain', 'proxyId'])
  })
})
