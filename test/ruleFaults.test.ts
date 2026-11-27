import { ruleFormOf } from '@utils/ruleDraft'
import type { RuleForm } from '@utils/ruleDraft'
import { faultRowsOf, ruleFormFaults } from '@utils/ruleFaults'

function validForm (overrides: Partial<RuleForm> = {}): RuleForm {
  return {
    ...ruleFormOf(),
    name: 'video',
    match: ['*://*.video.example/*'],
    proxyId: 'p1',
    ...overrides,
  }
}

describe('rule form faults for valid values', () => {
  it('accepts a minimal rule', () => {
    expect(ruleFormFaults(validForm())).toEqual([])
  })

  it('accepts host, type, site and static extension values in their accepted shapes', () => {
    const form = validForm({
      bypassUrlPatterns: ['*://cdn.example.com/*'],
      forceProxyUrlPatterns: ['*://*.example.org/*'],
      resourceTypeMode: 'only',
      onlyResourceTypes: ['media'],
      proxyOnlyPageHostnames: ['example.com', '*.example.net'],
      staticExtensions: '/\\.(jpg|png)$/',
    })

    expect(ruleFormFaults(form)).toEqual([])
  })

  it('ignores blank pattern and site rows', () => {
    expect(ruleFormFaults(validForm({ bypassUrlPatterns: [''], proxyOnlyPageHostnames: ['  '] }))).toEqual([])
  })

  it('finds no row faults when the faults are for another field', () => {
    expect(faultRowsOf(ruleFormFaults(validForm()), 'bypassUrlPatterns')).toEqual({})
  })
})
