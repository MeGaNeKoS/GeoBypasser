import type { ProxyRule } from '@customTypes/proxy'
import { nonBlank, ruleFormOf, ruleFromForm, ruleListSavingAt, ruleListWithNew } from '@utils/ruleDraft'
import type { RuleForm } from '@utils/ruleDraft'

const STORED_RULE: ProxyRule = {
  active: true,
  name: 'video',
  match: ['*://*.video.example/*'],
  proxyId: 'p1',
  bypassUrlPatterns: ['*://cdn.video.example/*'],
  fallbackDirect: true,
}

function formWith (overrides: Partial<RuleForm>): RuleForm {
  return { ...ruleFormOf(STORED_RULE), ...overrides }
}

describe('rule form values', () => {
  it('starts a new rule active, connecting directly on failure, with no tuning', () => {
    const form = ruleFormOf()

    expect(form).toMatchObject({ name: '', active: true, proxyId: '', resourceTypeMode: 'never', fallbackDirect: false })
    expect(form.neverResourceTypes).toEqual([])
    expect(form.onlyResourceTypes).toEqual([])
  })

  it('shows Only when the stored rule has a resource type list for that mode', () => {
    const rule = { ...STORED_RULE, proxyOnlyResourceTypes: ['media', 'xmlhttprequest'] }

    expect(ruleFormOf(rule)).toMatchObject({ resourceTypeMode: 'only', onlyResourceTypes: ['media', 'xmlhttprequest'] })
  })

  it('shows Never for a stored bypass list', () => {
    const rule = { ...STORED_RULE, bypassResourceTypes: ['image'] }

    expect(ruleFormOf(rule)).toMatchObject({ resourceTypeMode: 'never', neverResourceTypes: ['image'] })
  })
})

describe('rule from form', () => {
  it('writes the never list and removes the only list when the mode is Never', () => {
    const stored = { ...STORED_RULE, proxyOnlyResourceTypes: ['media'] }
    const rule = ruleFromForm(formWith({ resourceTypeMode: 'never', neverResourceTypes: ['image'] }), stored)

    expect(rule.bypassResourceTypes).toEqual(['image'])
    expect(rule).not.toHaveProperty('proxyOnlyResourceTypes')
  })

  it('writes the only list and removes the never list when the mode is Only', () => {
    const stored = { ...STORED_RULE, bypassResourceTypes: ['image'] }
    const rule = ruleFromForm(formWith({ resourceTypeMode: 'only', onlyResourceTypes: ['media'] }), stored)

    expect(rule.proxyOnlyResourceTypes).toEqual(['media'])
    expect(rule).not.toHaveProperty('bypassResourceTypes')
  })

  it('removes a site list the form has emptied', () => {
    const stored = { ...STORED_RULE, proxyOnlyPageHostnames: ['example.com'] }
    const rule = ruleFromForm(formWith({ proxyOnlyPageHostnames: ['', '  '] }), stored)

    expect(rule).not.toHaveProperty('proxyOnlyPageHostnames')
  })

  it('keeps a site list the form shows, trimmed, with blank rows dropped', () => {
    const rule = ruleFromForm(formWith({ proxyOnlyPageHostnames: [' example.com ', ''] }))

    expect(rule.proxyOnlyPageHostnames).toEqual(['example.com'])
  })

  it('keeps stored fields the form does not show', () => {
    const stored = { ...STORED_RULE, futureOption: 'kept' } as ProxyRule

    expect(ruleFromForm(formWith({}), stored)).toHaveProperty('futureOption', 'kept')
  })

  it('drops blank match patterns and trims the name', () => {
    const rule = ruleFromForm(formWith({ name: '  video  ', match: ['*://a.example/*', ' '] }))

    expect(rule.name).toBe('video')
    expect(rule.match).toEqual(['*://a.example/*'])
  })

  it('removes the static extensions and fallback keys when they are empty or off', () => {
    const stored = { ...STORED_RULE, staticExtensions: '/\\.png$/' }
    const rule = ruleFromForm(formWith({ staticExtensions: '', fallbackDirect: false }), stored)

    expect(rule).not.toHaveProperty('staticExtensions')
    expect(rule).not.toHaveProperty('fallbackDirect')
  })
})

describe('rule list edits', () => {
  it('replaces the rule at its position with the saved form', () => {
    const list = [STORED_RULE, { ...STORED_RULE, name: 'other' }]
    const saved = ruleListSavingAt(list, 0, STORED_RULE, formWith({ name: 'renamed' }))

    expect(saved?.[0]).toMatchObject({ name: 'renamed', proxyId: 'p1' })
    expect(saved?.[1]).toEqual(list[1])
  })

  it('replaces a set aside null entry in place with the saved rule', () => {
    const list = [null, STORED_RULE] as unknown as ProxyRule[]
    const saved = ruleListSavingAt(list, 0, undefined, formWith({ name: 'fixed', match: ['*://a.example/*'] }))

    expect(saved?.[0]).toMatchObject({ name: 'fixed', match: ['*://a.example/*'], proxyId: 'p1' })
    expect(saved?.[1]).toEqual(STORED_RULE)
  })

  it('replaces a set aside text entry in place without copying its characters', () => {
    const list = ['not a rule', STORED_RULE]
    const saved = ruleListSavingAt(list, 0, 'not a rule', formWith({ name: 'fixed' }))

    expect(saved?.[0]).toMatchObject({ name: 'fixed' })
    expect(saved?.[0]).not.toHaveProperty('0')
  })

  it('refuses the save when the rule at the position changed after it was opened', () => {
    const list = [{ ...STORED_RULE, name: 'changed elsewhere' }]

    expect(ruleListSavingAt(list, 0, STORED_RULE, formWith({ name: 'mine' }))).toBeUndefined()
  })

  it('appends a new rule after the existing ones', () => {
    const list = ruleListWithNew([STORED_RULE], formWith({ name: 'added', proxyId: 'p2' }))

    expect(list).toHaveLength(2)
    expect(list[1]).toMatchObject({ name: 'added', proxyId: 'p2' })
  })
})

describe('nonBlank', () => {
  it('trims each value and drops the empty ones', () => {
    expect(nonBlank([' a ', '', '  ', 'b'])).toEqual(['a', 'b'])
  })
})
