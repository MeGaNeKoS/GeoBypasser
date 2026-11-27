import { navCounts } from '@utils/pageView'

describe('navCounts with nothing stored', () => {
  it('reports zero counts and nothing needing fixing for every counted section', () => {
    expect(navCounts({})).toEqual({
      proxies: { count: 0, needsFixing: 0 },
      rules: { count: 0, needsFixing: 0 },
      sites: { count: 0, needsFixing: 0 },
      keepAlive: { count: 0, needsFixing: 0 },
    })
  })
})
