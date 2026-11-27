import { exportedRules } from '@utils/ruleExport'

const setAsideRule = { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'good', staticExtensions: '/(/' }

describe('exporting a rule set aside for a fault other than its static extensions', () => {
  it('writes the stored rule whole, with its proxy id, even when the caller does not keep it', () => {
    const [exported] = exportedRules([setAsideRule], () => false)
    expect(exported).toEqual(setAsideRule)
  })
})
