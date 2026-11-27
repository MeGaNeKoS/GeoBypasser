import { ruleRows } from '@utils/pageView'

const goodProxy = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }

describe('set aside rules for an unknown resource type show the reason', () => {
  it('gives a bypass resource type that is not known its sentence', () => {
    const [row] = ruleRows([{ ...goodRule, bypassResourceTypes: ['bogus'] }], [goodProxy])
    expect(row.invalid).toBe(true)
    expect(row.faults).toEqual(['Unknown resource type: bogus.'])
  })

  it('gives each unknown proxy only resource type its own sentence', () => {
    const [row] = ruleRows([{ ...goodRule, proxyOnlyResourceTypes: ['image', 'nope', 'zap'] }], [goodProxy])
    expect(row.faults).toEqual(['Unknown resource type: nope.', 'Unknown resource type: zap.'])
  })
})
