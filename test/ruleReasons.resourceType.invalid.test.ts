import { ruleRows } from '@utils/pageView'

const goodProxy = { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false, label: 'Good' }
const goodRule = { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'good' }

describe('rules with known resource types give no resource type reason', () => {
  it('leaves a usable rule with known bypass and only types unshown as invalid', () => {
    const [row] = ruleRows([{ ...goodRule, bypassResourceTypes: ['image', 'script'], proxyOnlyResourceTypes: ['xmlhttprequest'] }], [goodProxy])
    expect(row.invalid).toBe(false)
    expect(row.faults).toEqual([])
  })

  it('does not add a resource type sentence to a rule set aside for another fault', () => {
    const [row] = ruleRows([{ ...goodRule, match: ['not a pattern'], bypassResourceTypes: ['image'] }], [goodProxy])
    expect(row.invalid).toBe(true)
    expect(row.faults.some(fault => fault.startsWith('Unknown resource type'))).toBe(false)
  })
})
