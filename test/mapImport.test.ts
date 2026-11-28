import { duplicateKeysOf, mapAfterImport } from '@utils/mapImport'

const stored = { 'news.example': 'p1', 'shop.example': 'p2' }
const incoming = { 'news.example': 'p9', 'new.example': 'p3' }

describe('importing a map of entries keyed by domain or proxy', () => {
  it('lists only the incoming keys that are already stored', () => {
    expect(duplicateKeysOf(stored, incoming)).toEqual(['news.example'])
  })

  it('adds new keys and keeps a stored entry when its duplicate is not chosen for replacement', () => {
    expect(mapAfterImport(stored, incoming, [])).toEqual({ ...stored, 'new.example': 'p3' })
  })

  it('replaces only the duplicates chosen for replacement', () => {
    expect(mapAfterImport(stored, incoming, ['news.example'])).toEqual({
      'news.example': 'p9',
      'shop.example': 'p2',
      'new.example': 'p3',
    })
  })
})
