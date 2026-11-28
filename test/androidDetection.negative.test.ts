import { isAndroidUserAgent } from '@utils/env'

describe('a desktop or iOS user agent is not Android', () => {
  it('rejects a desktop Firefox user agent', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe(false)
  })

  it('rejects an iPhone user agent', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toBe(false)
  })

  it('rejects an empty user agent', () => {
    expect(isAndroidUserAgent('')).toBe(false)
  })
})
