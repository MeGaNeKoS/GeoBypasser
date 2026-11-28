import { unavailableLabel } from '../src/ui/components/proxy-select'

describe('unavailable proxy label for a stored proxy that is set aside', () => {
  it('names the stored proxy by its label', () => {
    expect(unavailableLabel('Tokyo SOCKS', 'tokyo')).toBe('Unavailable: Tokyo SOCKS')
  })
})
