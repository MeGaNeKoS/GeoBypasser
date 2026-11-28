import { isSetAsideOnlyHash, setAsideOnlyHashFor } from '@ui/shell/routes'

describe('set aside only hashes outside the set aside sections', () => {
  it('keeps the set aside query for the sites section', () => {
    expect(isSetAsideOnlyHash('#sites?set-aside')).toBe(true)
    expect(setAsideOnlyHashFor('sites')).toBe('#sites?set-aside')
  })

  it('does not treat a plain section hash as set aside only', () => {
    expect(isSetAsideOnlyHash('#proxies')).toBe(false)
    expect(isSetAsideOnlyHash('#rules')).toBe(false)
    expect(isSetAsideOnlyHash('')).toBe(false)
  })

  it('does not treat a different query as set aside only', () => {
    expect(isSetAsideOnlyHash('#rules?other=1')).toBe(false)
  })

  it('keeps the set aside query for keep-alive and leaves other sections plain', () => {
    expect(setAsideOnlyHashFor('keep-alive')).toBe('#keep-alive?set-aside')
    expect(setAsideOnlyHashFor('defaults')).toBe('#defaults')
  })
})
