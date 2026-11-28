import { routeLabel } from '@utils/requestLog'
import { DIRECT_ROUTE } from '@utils/pacRoute'
import type { RecordedRoute } from '@utils/networkUsage'

const rule = { index: 0, name: 'site only' }

describe('a direct route names why the rule sent it direct', () => {
  it.each([
    ['a never proxy host', { reason: 'bypass', route: DIRECT_ROUTE, expected: true, rule }, "Direct, skipped by rule 'site only'"],
    ['a request outside the page or type limits', { reason: 'outsideScope', route: DIRECT_ROUTE, expected: true, rule }, "Direct, outside rule 'site only' limits"],
  ] as [string, RecordedRoute, string][])('labels %s', (_case, route, expected) => {
    expect(routeLabel(route, [])).toBe(expected)
  })
})
