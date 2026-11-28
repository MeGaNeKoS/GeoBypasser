import { ruleFormForSelection } from '@utils/requestLogRule'
import { ruleFormOf } from '@utils/ruleDraft'

const PAGE = 'page.example'
const HOST = 'cdn.example.com'

describe('rule from a request log selection, negative cases', () => {
  it('leaves the types out on Chrome, which cannot match by type', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: [HOST], types: [{ host: HOST, type: 'script' }] }, false)

    expect(form).toEqual({ ...ruleFormOf(), name: PAGE, match: [`*://${HOST}/*`] })
  })

  it('drops a logged type the rule form does not know', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: [HOST], types: [{ host: HOST, type: 'telemetry' }] }, true)

    expect(form.resourceTypeMode).toBe('never')
    expect(form.onlyResourceTypes).toEqual([])
    expect(form.proxyOnlyPageHostnames).toEqual([])
  })

  it('creates no match and keeps the page name when no host is selected', () => {
    const form = ruleFormForSelection({ page: PAGE, hosts: [], types: [] }, true)

    expect(form.match).toEqual([])
    expect(form.name).toBe(PAGE)
  })
})
