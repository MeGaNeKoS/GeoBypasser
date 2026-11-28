import { NetworkUsageSchema } from '@schemas/networkUsage'
import {
  addRequestToTab,
  emptyTabUsage,
  expectedRecordedRoute,
  formatBytes,
  pageHostFor,
  type RecordedRoute,
  type RequestObservation,
  type TabUsage,
} from '@utils/networkUsage'

const PAGE = 'page.example'
const REQUEST_HOST = 'cdn.example.com'
const RULE_ROUTE: RecordedRoute = {
  reason: 'rule',
  route: 'PROXY good.lan:8080',
  expected: false,
  rule: { index: 0, name: 'example' },
}

function observation (overrides: Partial<RequestObservation> = {}): RequestObservation {
  return {
    pageHost: PAGE,
    requestUrl: `https://${REQUEST_HOST}/a/file.bin`,
    resourceType: 'image',
    statusCode: 200,
    fromCache: false,
    sentBytes: 120,
    receivedBytes: 4096,
    receivedSizeKnown: true,
    route: RULE_ROUTE,
    ...overrides,
  }
}

function usageAfter (...observations: RequestObservation[]): TabUsage {
  const tab = emptyTabUsage()
  observations.forEach(entry => addRequestToTab(tab, entry))
  return tab
}

describe('network usage for a page', () => {
  it('counts a request under its page host and request host', () => {
    const host = usageAfter(observation())[PAGE][REQUEST_HOST]

    expect(host.count).toBe(1)
    expect(host.ok).toBe(1)
    expect(host.sent).toBe(120)
    expect(host.received).toBe(4096)
  })

  it('tallies the resource types of the requests to a host', () => {
    const host = usageAfter(
      observation({ resourceType: 'image' }),
      observation({ resourceType: 'script' }),
      observation({ resourceType: 'image' }),
    )[PAGE][REQUEST_HOST]

    expect(host.types).toEqual({ image: 2, script: 1 })
  })

  it('tallies each route with the number of requests that took it', () => {
    const host = usageAfter(observation(), observation())[PAGE][REQUEST_HOST]

    expect(Object.values(host.routes)).toEqual([{ route: RULE_ROUTE, count: 2 }])
  })

  it('keeps a route for each distinct rule that routed a host', () => {
    const otherRule: RecordedRoute = { ...RULE_ROUTE, rule: { index: 1, name: 'second' } }
    const host = usageAfter(observation(), observation({ route: otherRule }))[PAGE][REQUEST_HOST]

    expect(Object.keys(host.routes)).toHaveLength(2)
  })

  it('counts a request answered with a status below 400 as OK', () => {
    const host = usageAfter(observation({ statusCode: 304 }))[PAGE][REQUEST_HOST]

    expect(host.ok).toBe(1)
    expect(host.statuses).toEqual({})
  })

  it('counts a request answered with an error status by that status', () => {
    const host = usageAfter(observation({ statusCode: 403 }))[PAGE][REQUEST_HOST]

    expect(host.ok).toBe(0)
    expect(host.statuses).toEqual({ 403: 1 })
  })

  it('counts a request that failed under its reason', () => {
    const host = usageAfter(observation({ statusCode: undefined, error: 'net::ERR_BLOCKED_BY_CLIENT', receivedBytes: 0 }))[PAGE][REQUEST_HOST]

    expect(host.failures).toEqual({ 'net::ERR_BLOCKED_BY_CLIENT': 1 })
  })

  it('counts a request served from cache', () => {
    const host = usageAfter(observation({ fromCache: true }))[PAGE][REQUEST_HOST]

    expect(host.fromCache).toBe(1)
  })

  it('counts a response with no reported size as a request with unsized bytes', () => {
    const host = usageAfter(observation({ receivedBytes: 0, receivedSizeKnown: false }))[PAGE][REQUEST_HOST]

    expect(host.count).toBe(1)
    expect(host.unsizedCount).toBe(1)
    expect(host.received).toBe(0)
  })

  it('keeps the path tree by its first and second segments', () => {
    const host = usageAfter(observation({ requestUrl: `https://${REQUEST_HOST}/alpha/beta/c.js` }))[PAGE][REQUEST_HOST]

    expect(host.paths.alpha.sent).toBe(120)
    expect(host.paths.alpha.children.beta.received).toBe(4096)
  })

  it.each(['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString'])('keeps a host, path segment, and type named %s as its own key', name => {
    const host = usageAfter(observation({
      requestUrl: `https://${name}.example/${name}/b`,
      resourceType: name,
    }))[PAGE][`${name.toLowerCase()}.example`]

    expect(host.types[name]).toBe(1)
    expect(host.paths[name].children.b.received).toBe(4096)
  })

  it('writes nothing onto Object.prototype', () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort()

    usageAfter(observation({ requestUrl: 'https://host.example/__proto__/x', resourceType: 'constructor' }))

    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before)
  })

  it('serializes to a payload the schema accepts', () => {
    const payload = JSON.parse(JSON.stringify({ '7': usageAfter(observation(), observation({ statusCode: 403 })) }))

    expect(NetworkUsageSchema.parse(payload)['7'][PAGE][REQUEST_HOST].count).toBe(2)
  })
})

describe('page host of a request', () => {
  it('uses the host of the document that made the request', () => {
    expect(pageHostFor('https://cdn.example.com/x', 'https://page.example/')).toBe('page.example')
  })

  it('uses the request host when the request has no document', () => {
    expect(pageHostFor('https://cdn.example.com/x', undefined)).toBe('cdn.example.com')
  })
})

describe('expected route of a request', () => {
  it('marks a route recomputed from the config as expected', () => {
    expect(expectedRecordedRoute({ route: 'DIRECT', reason: 'default' })).toEqual({
      reason: 'default',
      route: 'DIRECT',
      expected: true,
      rule: undefined,
    })
  })
})

describe('byte counts shown to the user', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [2048, '2.00 KB'],
    [5 * 1024 * 1024, '5.00 MB'],
  ])('formats %d bytes as %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text)
  })
})
