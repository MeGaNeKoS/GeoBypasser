import { ruleFormOf } from '@utils/ruleDraft'
import type { RuleForm } from '@utils/ruleDraft'
import { tuningPhrasesOf } from '@utils/ruleTuning'

function formWith (overrides: Partial<RuleForm>): RuleForm {
  return { ...ruleFormOf(), name: 'video', match: ['*://*.video.example/*'], proxyId: 'p1', ...overrides }
}

describe('tuning phrases leave out static extensions that are ignored', () => {
  it('has no phrase for a static extensions pattern that does not compile', () => {
    expect(tuningPhrasesOf(formWith({ staticExtensions: '/(/' }))).toEqual([])
  })
})
