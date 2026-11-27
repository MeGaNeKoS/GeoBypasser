import { overridesWithHost, overridesWithoutHost } from '@utils/usable'

describe('setting and clearing a site override removes every stored case variant', () => {
  const stored = { 'Mixed.Example.NET': 'good', 'MIXED.example.net': 'other', 'other.test': 'good' }

  it('clearing removes every case variant of the host and keeps other hosts', () => {
    expect(overridesWithoutHost(stored, 'mixed.example.net')).toEqual({ 'other.test': 'good' })
  })

  it('setting replaces every case variant with one lowercase key', () => {
    expect(overridesWithHost(stored, 'mixed.example.net', 'new')).toEqual({
      'other.test': 'good',
      'mixed.example.net': 'new'
    })
  })

  it('does not change the map it is given', () => {
    overridesWithHost(stored, 'mixed.example.net', 'new')
    expect(Object.keys(stored)).toEqual(['Mixed.Example.NET', 'MIXED.example.net', 'other.test'])
  })
})
