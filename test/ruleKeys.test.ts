import { ruleKeyAt, rowFocusKeyAfterChange } from '@utils/ruleKeys'

describe('rule focus keys', () => {
  it('gives the same rule the same key whatever the property order of its stored object', () => {
    const stored = { name: 'News UK', active: true, match: ['*://news.example/*'], proxyId: 'london' }
    const reordered = { proxyId: 'london', match: ['*://news.example/*'], active: true, name: 'News UK' }

    expect(ruleKeyAt([stored], 0)).toBe(ruleKeyAt([reordered], 0))
  })

  it('gives identical rules different keys by occurrence', () => {
    const rule = { name: 'Music', active: true, match: ['*://music.example/*'] }

    expect(ruleKeyAt([rule, rule], 0)).not.toBe(ruleKeyAt([rule, rule], 1))
  })

  it('keeps a rule key when rules are inserted above it', () => {
    const news = { name: 'News UK', active: true, match: ['*://news.example/*'] }
    const inserted = { name: 'First', active: true, match: ['*://first.example/*'] }

    expect(ruleKeyAt([news], 0)).toBe(ruleKeyAt([inserted, news], 1))
  })

  it('changes the key when the stored content changes', () => {
    const before = { name: 'News UK', active: true, match: ['*://news.example/*'] }
    const after = { ...before, active: false }

    expect(ruleKeyAt([before], 0)).not.toBe(ruleKeyAt([after], 0))
  })

  it('ignores the compiled matcher fields a loaded rule carries at runtime', () => {
    const stored = { name: 'News UK', active: true, match: ['*://news.example/*'] }
    const loaded = { ...stored, compiledMatch: /news/, compiledStaticExtensions: /\.png$/ }

    expect(ruleKeyAt([loaded], 0)).toBe(ruleKeyAt([stored], 0))
  })
})

describe('row focus after a rule changes elsewhere', () => {
  it('keeps the focus key when the focused rule still exists', () => {
    expect(rowFocusKeyAfterChange('edit-a#0', ['a#0', 'b#0'], ['b#0', 'a#0'])).toBeUndefined()
  })

  it('falls back to the same control at the same position when the focused rule key is gone', () => {
    expect(rowFocusKeyAfterChange('switch-a#0', ['a#0', 'b#0'], ['c#0', 'b#0'])).toBe('switch-c#0')
  })

  it('falls back to the last row when the focused position no longer exists', () => {
    expect(rowFocusKeyAfterChange('edit-b#0', ['a#0', 'b#0'], ['c#0'])).toBe('edit-c#0')
  })

  it('leaves focus alone when the focused element is not a rule row control', () => {
    expect(rowFocusKeyAfterChange('add', ['a#0'], ['b#0'])).toBeUndefined()
  })

  it('gives no fallback when no rules remain', () => {
    expect(rowFocusKeyAfterChange('edit-a#0', ['a#0'], [])).toBeUndefined()
  })
})
