import { keepAliveReasons, keepAliveTestUrlIgnoredNote, overrideReasons } from '@utils/setAsideReasons'

describe('site and keep-alive set aside reasons name what is wrong', () => {
  it('gives the host name reason for a site domain that is not a host name', () => {
    expect(overrideReasons('bad domain.example', 'good')).toEqual(['Domain is not a valid host name, such as example.com.'])
  })

  it('gives the proxy reason for a site with no proxy chosen', () => {
    expect(overrideReasons('a.example', '')).toEqual(['No proxy is chosen for this site.'])
  })

  it('states that a keep-alive rule has no tab URL pattern', () => {
    expect(keepAliveReasons({ active: true })).toEqual(['No tab URL pattern.'])
  })

  it('numbers the tab URL pattern that is not valid', () => {
    expect(keepAliveReasons({ active: true, tabUrls: ['example.com', 'not a pattern'] }))
      .toEqual(['Tab URL pattern 2 is not valid.'])
  })

  it('states that a keep-alive rule has no active state', () => {
    expect(keepAliveReasons({ tabUrls: ['example.com'] })).toEqual(['Active state is missing.'])
  })

  it('gives the test URL note for a keep-alive test URL that is not http or https', () => {
    expect(keepAliveTestUrlIgnoredNote({ active: true, tabUrls: ['example.com'], testProxyUrl: 'ftp://a.example/' }))
      .toEqual('Test URL is not valid, so the default test URL is used.')
  })
})
