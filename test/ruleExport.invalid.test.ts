import { exportedRule, exportedRules } from '@utils/ruleExport'

describe('a set aside rule is skipped when exporting', () => {
  it.each([
    ['null', null],
    ['a string', 'set aside text'],
    ['a number', 42],
    ['an array', ['rule']],
  ])('exports nothing for %s', (_, entry) => {
    expect(exportedRule(entry, true)).toBeUndefined()
  })

  it('leaves out the non object entries from a list', () => {
    const exported = exportedRules([null, 'set aside text', { name: 'Kept', proxyId: 'p1' }], () => true)
    expect(exported).toEqual([{ name: 'Kept', proxyId: 'p1' }])
  })
})

describe('a set aside rule object is written exactly as stored', () => {
  it('adds no active flag and keeps the proxy id even when it is not kept', () => {
    const setAside = { name: 'Example', proxyId: 'gone' }
    expect(exportedRule(setAside, false)).toBe(setAside)
  })

  it('keeps a set aside object whose proxy is not in the export list unchanged', () => {
    const setAside = { name: 'Example', proxyId: 'gone', match: ['not a pattern'] }
    expect(exportedRules([setAside], () => false)).toEqual([setAside])
  })
})
