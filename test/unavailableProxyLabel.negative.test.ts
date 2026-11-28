import { unavailableLabel } from '../src/ui/components/proxy-select'

describe('unavailable proxy label for a proxy no longer stored', () => {
  it('names the missing proxy by its id', () => {
    expect(unavailableLabel(undefined, 'deleted-id')).toBe('Unavailable: deleted-id')
  })
})
