import { assertNetworkUsage } from '@schemas/networkUsage'
import { addRequestToTab, emptyTabUsage, pageHostFor, type RecordedRoute, type RequestObservation } from '@utils/networkUsage'

const UNROUTED: RecordedRoute = { reason: 'unknown', route: '', expected: false }

function observation (overrides: Partial<RequestObservation> = {}): RequestObservation {
  return {
    pageHost: 'page.example',
    requestUrl: 'https://cdn.example.com/a/file.bin',
    resourceType: 'image',
    statusCode: 200,
    fromCache: false,
    sentBytes: 0,
    receivedBytes: 0,
    receivedSizeKnown: true,
    route: UNROUTED,
    ...overrides,
  }
}

describe('network usage that is not recorded', () => {
  it('ignores a request whose url does not parse', () => {
    const tab = emptyTabUsage()

    addRequestToTab(tab, observation({ requestUrl: 'not a url' }))

    expect(Object.keys(tab)).toEqual([])
  })

  it('falls back to the request host when the document url does not parse', () => {
    expect(pageHostFor('https://cdn.example.com/x', 'not a url')).toBe('cdn.example.com')
  })
})

describe('network usage payload rejection', () => {
  const validHost = {
    count: 1,
    types: {},
    ok: 1,
    statuses: {},
    failures: {},
    fromCache: 0,
    sent: 0,
    received: 0,
    unsizedCount: 0,
    routes: {},
    paths: {},
  }

  it('rejects a payload that is not keyed by tab, page and host', () => {
    expect(() => assertNetworkUsage({ '7': { 'page.example': validHost } })).toThrow()
  })

  it('rejects a host with a negative byte count', () => {
    expect(() => assertNetworkUsage({ '7': { 'page.example': { 'cdn.example.com': { ...validHost, sent: -1 } } } })).toThrow()
  })

  it('rejects a route with a reason the recorder does not write', () => {
    const route = { reason: 'bogus', route: 'DIRECT', expected: true }
    const host = { ...validHost, routes: { k: { route, count: 1 } } }

    expect(() => assertNetworkUsage({ '7': { 'page.example': { 'cdn.example.com': host } } })).toThrow()
  })
})
