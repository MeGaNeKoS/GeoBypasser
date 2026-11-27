import { ruleFormOf } from '@utils/ruleDraft'
import type { RuleForm } from '@utils/ruleDraft'
import { chromeIgnoresLimits, resourceTypeHelpOf, summaryPhrasesShown, tuningPhrasesOf } from '@utils/ruleTuning'

function formWith (overrides: Partial<RuleForm>): RuleForm {
  return { ...ruleFormOf(), name: 'video', match: ['*://*.video.example/*'], proxyId: 'p1', ...overrides }
}

describe('tuning phrases for options in use', () => {
  it('counts the never and always host lists in the design wording', () => {
    const form = formWith({ bypassUrlPatterns: ['*://a.example/*', '*://b.example/*'], forceProxyUrlPatterns: ['*://c.example/*'] })

    expect(tuningPhrasesOf(form).map(phrase => phrase.text)).toEqual(['skips 2 hosts', 'forces 1 host'])
  })

  it('reads Never types as skips and Only types as only', () => {
    expect(tuningPhrasesOf(formWith({ resourceTypeMode: 'never', neverResourceTypes: ['image', 'font', 'media'] })))
      .toEqual([{ text: 'skips 3 types', firefoxOnly: true }])
    expect(tuningPhrasesOf(formWith({ resourceTypeMode: 'only', onlyResourceTypes: ['media', 'xmlhttprequest', 'script'] })))
      .toEqual([{ text: 'only 3 types', firefoxOnly: true }])
  })

  it('names one type and one site in the singular', () => {
    expect(tuningPhrasesOf(formWith({ resourceTypeMode: 'only', onlyResourceTypes: ['media'] }))[0].text).toBe('only 1 type')
    expect(tuningPhrasesOf(formWith({ proxyOnlyPageHostnames: ['example.com'] }))[0].text).toBe('on 1 site')
  })

  it('says skips files for a static extension pattern without a count and without the Firefox badge', () => {
    expect(tuningPhrasesOf(formWith({ staticExtensions: '/\\.png$/' }))).toEqual([{ text: 'skips files', firefoxOnly: false }])
  })

  it('keeps the order of the groups', () => {
    const form = formWith({
      proxyOnlyPageHostnames: ['example.com'],
      staticExtensions: '/\\.png$/',
      resourceTypeMode: 'never',
      neverResourceTypes: ['image'],
      forceProxyUrlPatterns: ['*://c.example/*'],
      bypassUrlPatterns: ['*://a.example/*'],
    })

    expect(tuningPhrasesOf(form).map(phrase => phrase.text))
      .toEqual(['skips 1 host', 'forces 1 host', 'skips 1 type', 'skips files', 'on 1 site'])
  })

  it('shows at most two phrases and counts the rest', () => {
    const phrases = tuningPhrasesOf(formWith({
      bypassUrlPatterns: ['*://a.example/*'],
      forceProxyUrlPatterns: ['*://c.example/*'],
      proxyOnlyPageHostnames: ['example.com'],
    }))

    expect(summaryPhrasesShown(phrases)).toEqual({ shown: phrases.slice(0, 2), hiddenCount: 1 })
  })

  it('reports Chrome ignores the limits when Only types has a tick or a site is listed', () => {
    expect(chromeIgnoresLimits(formWith({ resourceTypeMode: 'only', onlyResourceTypes: ['media'] }))).toBe(true)
    expect(chromeIgnoresLimits(formWith({ proxyOnlyPageHostnames: ['example.com'] }))).toBe(true)
  })

  it('explains which ticked types connect directly in Never mode and which use the proxy in Only mode', () => {
    expect(resourceTypeHelpOf(formWith({ resourceTypeMode: 'never', neverResourceTypes: ['image'] })))
      .toBe('Requests of the ticked types connect directly.')
    expect(resourceTypeHelpOf(formWith({ resourceTypeMode: 'only', onlyResourceTypes: ['media'] })))
      .toBe('Only requests of the ticked types use the proxy. Every other type connects directly.')
  })
})
