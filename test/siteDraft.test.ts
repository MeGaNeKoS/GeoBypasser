import { siteFormFaults, siteMapAfterSave, siteMapWithout } from '@utils/siteDraft'

describe('site draft faults for a valid site', () => {
  it('reports no fault for a host name and a chosen proxy', () => {
    expect(siteFormFaults({ domain: 'example.com', proxyId: 'good' })).toEqual([])
  })

  it('reports no fault for a site sent directly', () => {
    expect(siteFormFaults({ domain: 'sub.example.com', proxyId: 'direct' })).toEqual([])
  })
})

describe('saving a site into the stored map', () => {
  it('adds a new site at the end and keeps the others', () => {
    expect(siteMapAfterSave({ 'a.example': 'p1' }, { domain: 'b.example', proxyId: 'p2' }, undefined))
      .toEqual({ 'a.example': 'p1', 'b.example': 'p2' })
  })

  it('replaces the old key when a site is renamed', () => {
    expect(siteMapAfterSave({ 'old.example': 'p1', 'keep.example': 'p2' }, { domain: 'new.example', proxyId: 'p1' }, 'old.example'))
      .toEqual({ 'keep.example': 'p2', 'new.example': 'p1' })
  })

  it('changes the proxy of an edited site without changing its key', () => {
    expect(siteMapAfterSave({ 'a.example': 'p1' }, { domain: 'a.example', proxyId: 'direct' }, 'a.example'))
      .toEqual({ 'a.example': 'direct' })
  })
})

describe('removing sites from the stored map', () => {
  it('drops only the listed domains', () => {
    expect(siteMapWithout({ 'a.example': 'p1', 'b.example': 'p2', 'c.example': 'p3' }, ['a.example', 'c.example']))
      .toEqual({ 'b.example': 'p2' })
  })
})
