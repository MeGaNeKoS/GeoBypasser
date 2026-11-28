import { addRequestToTab, emptyTabUsage, UNKNOWN_ROUTE, type NetworkUsage, type RecordedRoute, type RequestObservation } from '@utils/networkUsage'
import { requestLogPages, routeLabel } from '@utils/requestLog'

const PAGE = 'page.example'
const CDN_URL = 'https://cdn.example.com/a/file.bin'
const DIRECT_DEFAULT: RecordedRoute = { reason: 'default', route: 'DIRECT', expected: false }

function observation (overrides: Partial<RequestObservation> = {}): RequestObservation {
  return {
    pageHost: PAGE,
    requestUrl: CDN_URL,
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

describe('request log negative cases', () => {
  it('has no pages when nothing was recorded', () => {
    expect(requestLogPages({}, [])).toEqual([])
    expect(requestLogPages({ 1: emptyTabUsage() }, [])).toEqual([])
  })

  it('words a route nobody reported as Unknown route, not proxied', () => {
    const [page] = requestLogPages(usageOf(observation({ route: UNKNOWN_ROUTE })), [])

    expect(page.rows[0].routes[0]).toMatchObject({ label: 'Unknown route', proxied: false })
  })

  it('does not count a direct request as proxied bytes', () => {
    const [page] = requestLogPages(usageOf(observation({ receivedBytes: 500 })), [])

    expect(page.proxiedBytes).toBe(0)
    expect(page.totalBytes).toBe(500)
  })

  it('words 451 as blocked and other 4xx and 5xx as errors', () => {
    const [row] = requestLogPages(usageOf(observation({ statusCode: 451 }), observation({ statusCode: 404 })), [])[0].rows

    expect(row.results).toEqual([
      { kind: 'error', text: '1 error (404)' },
      { kind: 'blocked', text: '1 blocked (451)' },
    ])
  })

  it('counts a 301 redirect as OK', () => {
    const [row] = requestLogPages(usageOf(observation({ statusCode: 301 })), [])[0].rows

    expect(row.results).toEqual([{ kind: 'ok', text: '1 OK' }])
  })

  it('does not mark a direct route as proxied or inferred', () => {
    expect(routeLabel({ ...DIRECT_DEFAULT, inferred: false }, [])).toBe('Direct')
  })
})
