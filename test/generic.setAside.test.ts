import { getAllMatchUrls } from '@utils/generic'
import { compileRules } from '@utils/storage'

describe('getAllMatchUrls with a set aside rule', () => {
  it('excludes the patterns of a set aside rule', () => {
    const config: any = {
      rules: compileRules([
        { active: true, name: 'bad', match: ['not a pattern'], proxyId: 'p1' } as any,
        { active: true, name: 'good', match: ['https://example.com/*'], proxyId: 'p1' } as any,
      ]),
    }
    const urls = getAllMatchUrls(config)
    expect(urls).not.toContain('not a pattern')
    expect(urls).toContain('https://example.com/*')
  })
})
