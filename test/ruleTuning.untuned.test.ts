import { ruleFormOf } from '@utils/ruleDraft'
import type { RuleForm } from '@utils/ruleDraft'
import { chromeIgnoresLimits, resourceTypeHelpOf, tuningPhrasesOf } from '@utils/ruleTuning'

function formWith (overrides: Partial<RuleForm>): RuleForm {
  return { ...ruleFormOf(), name: 'video', match: ['*://*.video.example/*'], proxyId: 'p1', ...overrides }
}

describe('tuning phrases when nothing narrows the rule', () => {
  it('has no phrases for a new rule', () => {
    expect(tuningPhrasesOf(ruleFormOf())).toEqual([])
  })

  it('ignores blank host and site rows', () => {
    expect(tuningPhrasesOf(formWith({ bypassUrlPatterns: ['', '  '], proxyOnlyPageHostnames: [''] }))).toEqual([])
  })

  it('counts no type when the mode has no ticks', () => {
    expect(tuningPhrasesOf(formWith({ resourceTypeMode: 'only', onlyResourceTypes: [] }))).toEqual([])
  })

  it('does not treat the connect directly switch as tuning', () => {
    expect(tuningPhrasesOf(formWith({ fallbackDirect: true }))).toEqual([])
  })

  it('does not flag Chrome limits when Only is set with no types and no site is listed', () => {
    expect(chromeIgnoresLimits(formWith({ resourceTypeMode: 'only', onlyResourceTypes: [] }))).toBe(false)
    expect(chromeIgnoresLimits(formWith({ resourceTypeMode: 'never', neverResourceTypes: ['image'] }))).toBe(false)
  })

  it('says no type is ticked, so every type uses the proxy, when Only has no ticks', () => {
    expect(resourceTypeHelpOf(formWith({ resourceTypeMode: 'only', onlyResourceTypes: [] })))
      .toBe('No type is ticked, so every type uses the proxy.')
  })
})
