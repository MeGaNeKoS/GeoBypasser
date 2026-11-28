import { isAndroidUserAgent } from '@utils/env'

describe('detecting an Android browser from its user agent', () => {
  it('recognises an Android Firefox user agent', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0')).toBe(true)
  })

  it('recognises an Android Chrome user agent regardless of letter case', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (linux; ANDROID 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36')).toBe(true)
  })
})
