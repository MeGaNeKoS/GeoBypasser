import { navCounts } from '@utils/pageView'

const tokyo = { id: 'p1', type: 'http', host: 'tokyo.example', port: 8080, proxyDNS: false, label: 'Tokyo SOCKS' }
const brokenProxy = { id: 'p2', type: 'http', host: '', port: 0, proxyDNS: false }
const activeRule = { name: 'news', match: ['https://news.example/*'], proxyId: 'p1', active: true }
const offRule = { ...activeRule, name: 'off', active: false }
const brokenRule = { name: 'broken', match: [], proxyId: 'p1', active: true }

describe('navCounts', () => {
  it('counts every entry of each counted section, set aside entries included, and the entries set aside', () => {
    const counts = navCounts({
      proxyList: [tokyo, brokenProxy],
      rules: [activeRule, offRule, brokenRule],
      perWebsiteOverride: { 'news.example': 'p1', 'bad host': 'p1' },
      keepAliveRules: {
        p1: { active: true, tabUrls: ['news.example'] },
        p2: { active: true, tabUrls: [] },
      },
    })

    expect(counts).toEqual({
      proxies: { count: 2, needsFixing: 1 },
      rules: { count: 3, needsFixing: 1 },
      sites: { count: 2, needsFixing: 1 },
      keepAlive: { count: 2, needsFixing: 1 },
    })
  })
})
