import { hashForSection, sectionIdForHash } from '@ui/shell/routes'

describe('sectionIdForHash with a hash that names no section', () => {
  it('opens Home for an empty hash', () => {
    expect(sectionIdForHash('')).toBe('home')
    expect(sectionIdForHash('#')).toBe('home')
  })

  it('opens Home for an unknown hash', () => {
    expect(sectionIdForHash('#nope')).toBe('home')
  })

  it('does not match a hash with a different case', () => {
    expect(sectionIdForHash('#Proxies')).toBe('home')
  })
})

describe('hashForSection with a section id that names no route', () => {
  it('falls back to the home hash', () => {
    expect(hashForSection('missing')).toBe('home')
  })
})
