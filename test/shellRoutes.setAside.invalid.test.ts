import { isSetAsideOnlyHash, setAsideOnlyHashFor } from '@ui/shell/routes'

describe('set aside only hashes outside the proxies and rules sections', () => {
  it('builds a plain section hash for other sections', () => {
    expect(isSetAsideOnlyHash('#sites?set-aside')).toBe(true)
    expect(setAsideOnlyHashFor('sites')).toBe('#sites')
  })

  it('does not treat a plain section hash as set aside only', () => {
    expect(isSetAsideOnlyHash('#proxies')).toBe(false)
    expect(isSetAsideOnlyHash('#rules')).toBe(false)
    expect(isSetAsideOnlyHash('')).toBe(false)
  })

  it('does not treat a different query as set aside only', () => {
    expect(isSetAsideOnlyHash('#rules?other=1')).toBe(false)
  })

  it('links keep-alive to its plain section hash', () => {
    expect(setAsideOnlyHashFor('keep-alive')).toBe('#keep-alive')
  })
})
