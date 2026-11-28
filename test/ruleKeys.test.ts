import { ruleKeyAt } from '@utils/ruleKeys'

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
})
