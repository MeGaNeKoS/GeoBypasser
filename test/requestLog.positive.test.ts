import type { ProxyListItem } from '@customTypes/proxy'
import { addRequestToTab, emptyTabUsage, type NetworkUsage, type RecordedRoute, type RequestObservation } from '@utils/networkUsage'
import { formatCount, formatProxiedShare, requestLogPages, resultLines, routeLabel } from '@utils/requestLog'

const PAGE = 'page.example'
const CDN = 'cdn.example.com'
const RULE_ROUTE: RecordedRoute = { reason: 'rule', route: 'PROXY good.lan:8080', expected: true, rule: { index: 2, name: 'cdn' } }
const DIRECT_DEFAULT: RecordedRoute = { reason: 'default', route: 'DIRECT', expected: false }
const PROXIES = [{ id: 'good', label: 'good', host: 'good.lan', port: 8080 }] as ProxyListItem[]

function observation (overrides: Partial<RequestObservation> = {}): RequestObservation {
  return {
    pageHost: PAGE,
    requestUrl: `https://${CDN}/a/file.bin`,
    resourceType: 'image',
    statusCode: 200,
    fromCache: false,
    sentBytes: 0,
    receivedBytes: 0,
    receivedSizeKnown: true,
    route: DIRECT_DEFAULT,
    ...overrides,
  }
}

function usageOf (...observations: RequestObservation[]): NetworkUsage {
  const tab = emptyTabUsage()
  for (const entry of observations) addRequestToTab(tab, entry)
  return { 1: tab }
}

describe('request log', () => {
  it('groups requests by page host with one row per request host', () => {
    const usage = usageOf(
      observation({ requestUrl: `https://${CDN}/a.js`, resourceType: 'script' }),
      observation({ requestUrl: `https://${CDN}/b.png`, resourceType: 'image' }),
      observation({ requestUrl: 'https://api.example.com/x', resourceType: 'xmlhttprequest' }),
    )

    const [page] = requestLogPages(usage, PROXIES)

    expect(page.page).toBe(PAGE)
    expect(page.rows.map(row => row.host)).toEqual([CDN, 'api.example.com'])
    expect(page.rows[0].requests).toBe(2)
    expect(page.rows[0].types).toEqual([{ name: 'image', count: 1 }, { name: 'script', count: 1 }])
  })

  it('merges the same page and request host across tabs into one row', () => {
    const first = usageOf(observation({ sentBytes: 10, receivedBytes: 20 }))
    const second = usageOf(observation({ sentBytes: 1, receivedBytes: 2 }))
    const usage: NetworkUsage = { 1: first[1], 2: second[1] }

    const [page] = requestLogPages(usage, PROXIES)

    expect(page.rows).toHaveLength(1)
    expect(page.rows[0].requests).toBe(2)
    expect(page.rows[0].sentBytes).toBe(11)
    expect(page.rows[0].receivedBytes).toBe(22)
  })

  it('labels OK, blocked, error, failed and cached results', () => {
    const usage = usageOf(
      observation(),
      observation({ statusCode: 403 }),
      observation({ statusCode: 500 }),
      observation({ statusCode: undefined, error: 'net::ERR_CONNECTION_RESET' }),
      observation({ fromCache: true }),
    )

    const [row] = requestLogPages(usage, PROXIES)[0].rows

    expect(row.results).toEqual([
      { kind: 'ok', text: '2 OK' },
      { kind: 'blocked', text: '1 blocked (403)' },
      { kind: 'error', text: '1 errors (500)' },
      { kind: 'failed', text: '1 failed: net::ERR_CONNECTION_RESET' },
      { kind: 'cache', text: '1 from cache' },
    ])
  })

  it('counts a 304 as OK and keeps a zero byte request as a row', () => {
    const usage = usageOf(observation({ statusCode: 304, receivedBytes: 0 }))

    const [row] = requestLogPages(usage, PROXIES)[0].rows

    expect(resultLines(usageOf(observation({ statusCode: 304 }))[1][PAGE][CDN])).toEqual([{ kind: 'ok', text: '1 OK' }])
    expect(row.host).toBe(CDN)
    expect(row.requests).toBe(1)
  })

  it('names a route by its proxy label and reason, falling back to host and port for a missing proxy', () => {
    const usage = usageOf(
      observation({ route: { ...RULE_ROUTE, proxyId: 'good' } }),
      observation({ route: { reason: 'site', route: 'PROXY site.lan:9000', expected: false, proxyId: 'gone' } }),
    )

    const labels = requestLogPages(usage, PROXIES)[0].rows[0].routes.map(line => line.label)

    expect(labels).toEqual([
      "good, by rule 'cdn'",
      'site.lan:9000, by site proxy',
    ])
  })

  it('keeps the rule id and name on a rule route line', () => {
    const [line] = requestLogPages(usageOf(observation({ route: RULE_ROUTE })), PROXIES)[0].rows[0].routes

    expect(line).toMatchObject({ ruleId: 2, ruleName: 'cdn', proxied: true, expected: true })
  })

  it('totals proxied bytes against all bytes for a page', () => {
    const usage = usageOf(
      observation({ route: RULE_ROUTE, sentBytes: 100, receivedBytes: 900 }),
      observation({ route: DIRECT_DEFAULT, receivedBytes: 4000 }),
    )

    const [page] = requestLogPages(usage, PROXIES)

    expect(page.proxiedBytes).toBe(1000)
    expect(page.totalBytes).toBe(5000)
    expect(formatProxiedShare(page)).toBe('1000 B of 4.88 KB')
  })

  it('words a direct default route as Direct', () => {
    expect(routeLabel(DIRECT_DEFAULT, PROXIES)).toBe('Direct')
  })

  it('marks an inferred route as inferred', () => {
    expect(routeLabel({ ...RULE_ROUTE, proxyId: 'good', inferred: true }, PROXIES)).toBe("good, by rule 'cdn' (inferred)")
  })

  it('adds the unsized request count to the proxied share', () => {
    const [page] = requestLogPages(usageOf(observation({ route: RULE_ROUTE, receivedSizeKnown: false })), PROXIES)

    expect(formatProxiedShare(page)).toBe('0 B of 0 B (1 request without a size)')
  })

  it('pluralizes a count by its number', () => {
    expect(formatCount(1, 'tab')).toBe('1 tab')
    expect(formatCount(2, 'tab')).toBe('2 tabs')
    expect(formatCount(0, 'request')).toBe('0 requests')
  })
})
