import { hashForSection, sectionIdForHash } from '@ui/shell/routes'

describe('sectionIdForHash', () => {
  it('opens the section that the hash names', () => {
    expect(sectionIdForHash('#proxies')).toBe('proxy')
    expect(sectionIdForHash('#sites')).toBe('override')
    expect(sectionIdForHash('#keep-alive')).toBe('keepalive')
    expect(sectionIdForHash('#defaults')).toBe('general')
    expect(sectionIdForHash('#import-export')).toBe('impexp')
  })

  it('opens Home for the home hash', () => {
    expect(sectionIdForHash('#home')).toBe('home')
  })
})

describe('hashForSection', () => {
  it('names the hash of each section id', () => {
    expect(hashForSection('proxy')).toBe('proxies')
    expect(hashForSection('diagnostics')).toBe('test')
    expect(hashForSection('home')).toBe('home')
  })

  it('round trips every section through its hash', () => {
    for (const sectionId of ['home', 'proxy', 'rules', 'override', 'keepalive', 'general', 'diagnostics', 'network', 'impexp', 'about']) {
      expect(sectionIdForHash(`#${hashForSection(sectionId)}`)).toBe(sectionId)
    }
  })
})
