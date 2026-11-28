import { routeLabel } from '@utils/requestLog'
import { DIRECT_ROUTE } from '@utils/pacRoute'
import type { RecordedRoute } from '@utils/networkUsage'

const rule = { index: 0, name: 'site only' }

describe('a request outside rule limits is never labelled as a skip', () => {
  it('does not say skipped for a page or type limit', () => {
    const route: RecordedRoute = { reason: 'outsideScope', route: DIRECT_ROUTE, expected: true, rule }

    expect(routeLabel(route, [])).not.toContain('skipped')
  })
})
