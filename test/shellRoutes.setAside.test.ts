import { isSetAsideOnlyHash, sectionIdForHash, setAsideOnlyHashFor } from '@ui/shell/routes'

describe('set aside only hashes', () => {
  it('reads the set aside query on the proxies and rules hashes', () => {
    expect(isSetAsideOnlyHash('#proxies?set-aside')).toBe(true)
    expect(isSetAsideOnlyHash('#rules?set-aside')).toBe(true)
  })

  it('builds the set aside hash for the proxies and rules sections', () => {
    expect(setAsideOnlyHashFor('proxies')).toBe('#proxies?set-aside')
    expect(setAsideOnlyHashFor('rules')).toBe('#rules?set-aside')
  })

  it('resolves a hash with the set aside query to its section', () => {
    expect(sectionIdForHash('#rules?set-aside')).toBe('rules')
    expect(sectionIdForHash('#proxies?set-aside')).toBe('proxy')
  })
})
