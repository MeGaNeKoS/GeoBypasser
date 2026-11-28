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

function faultsOf (overrides: Partial<RuleForm>) {
  return ruleFormFaults(validForm(overrides))
}

describe('rule form faults for invalid values', () => {
  it('requires a name', () => {
    expect(faultsOf({ name: '   ' })).toEqual([{ field: 'name', message: 'Give the rule a name.' }])
  })

  it('requires at least one match pattern', () => {
    expect(faultsOf({ match: [''] })).toEqual([{ field: 'match', message: 'Add at least one match pattern.' }])
  })

  it('requires a proxy', () => {
    expect(faultsOf({ proxyId: '' })).toEqual([
      { field: 'proxyId', message: 'Choose the proxy this rule sends requests through.' },
    ])
  })

  it('marks the match pattern row that is not valid', () => {
    const faults = faultsOf({ match: ['*://ok.example/*', 'not a pattern'] })

    expect(faultRowsOf(faults, 'match')).toEqual({ 1: 'Pattern 2 is not a valid match pattern.' })
  })

  it('marks the bypass and force pattern rows that are not valid', () => {
    const faults = faultsOf({ bypassUrlPatterns: ['bad one'], forceProxyUrlPatterns: ['', 'also bad'] })

    expect(faultRowsOf(faults, 'bypassUrlPatterns')).toEqual({ 0: 'Pattern 1 is not a valid match pattern.' })
    expect(faultRowsOf(faults, 'forceProxyUrlPatterns')).toEqual({ 1: 'Pattern 2 is not a valid match pattern.' })
  })

  it('marks the site row that is not a host name', () => {
    const faults = faultsOf({ proxyOnlyPageHostnames: ['example.com', 'http://bad/path'] })

    expect(faultRowsOf(faults, 'proxyOnlyPageHostnames')).toEqual({
      1: 'Site 2 is not valid. Use a host name such as example.com or *.example.com.',
    })
  })

  it('refuses a static extension that is not a regular expression between slashes', () => {
    expect(faultsOf({ staticExtensions: 'jpg' })).toEqual([
      {
        field: 'staticExtensions',
        message: 'Not a valid regular expression. Write it between slashes, such as /\\.(jpg|png)$/.',
      },
    ])
  })
})
