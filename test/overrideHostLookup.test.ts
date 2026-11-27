import { overrideForHost } from '@utils/usable'

describe('override lookup by host with a mixed case key', () => {
  it('finds the override for a lowercase host', () => {
    expect(overrideForHost({ 'Mixed.Example.NET': 'good' }, 'mixed.example.net')).toBe('good')
  })
})
