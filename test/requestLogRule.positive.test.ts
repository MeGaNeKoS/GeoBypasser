import { ruleFormForSelection, ruleFormSkippingHost, selectionOnPage, withHostToggled, withTypeToggled } from '@utils/requestLogRule'
import { ruleFormOf } from '@utils/ruleDraft'

const PAGE = 'page.example'

describe('rule from a request log selection', () => {
  it('names the rule after the page and matches each selected host', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: ['cdn.example.com', 'img.example.com'], types: [] }, false)

    expect(form.name).toBe(PAGE)
    expect(form.match).toEqual(['*://cdn.example.com/*', '*://img.example.com/*'])
    expect(form.proxyId).toBe('')
  })

  it('limits the rule to the page and the selected types on Firefox', () => {
    const form = ruleFormForSelection({
      page: PAGE,
      hosts: ['cdn.example.com'],
      types: [{ host: 'cdn.example.com', type: 'script' }, { host: 'cdn.example.com', type: 'image' }],
    }, true)

    expect(form).toMatchObject({
      resourceTypeMode: 'only',
      onlyResourceTypes: ['script', 'image'],
      proxyOnlyPageHostnames: [PAGE],
    })
  })

  it('starts an empty selection when the page changes', () => {
    const onFirst = withHostToggled(selectionOnPage(undefined, PAGE), 'cdn.example.com')

    expect(selectionOnPage(onFirst, 'other.example')).toEqual({ page: 'other.example', hosts: [], types: [] })
    expect(selectionOnPage(onFirst, PAGE)).toBe(onFirst)
  })

  it('toggles a host off and drops its type selections with it', () => {
    const withType = withTypeToggled(selectionOnPage(undefined, PAGE), 'cdn.example.com', 'script')

    expect(withHostToggled(withType, 'cdn.example.com')).toEqual({ page: PAGE, hosts: [], types: [] })
  })

  it('selects the host of a type line when the type is toggled on', () => {
    const selection = withTypeToggled(selectionOnPage(undefined, PAGE), 'cdn.example.com', 'image')

    expect(selection).toEqual({ page: PAGE, hosts: ['cdn.example.com'], types: [{ host: 'cdn.example.com', type: 'image' }] })
  })

  it('adds the host to the never proxy list of a skipped rule', () => {
    const stored = ruleFormOf({ name: 'cdn', active: true, proxyId: 'p1', match: ['*://cdn.example.com/*'], bypassUrlPatterns: ['*://a.example.com/*'] })

    const form = ruleFormSkippingHost(stored, 'img.example.com')

    expect(form.bypassUrlPatterns).toEqual(['*://a.example.com/*', '*://img.example.com/*'])
    expect(form.match).toEqual(stored.match)
  })
})
