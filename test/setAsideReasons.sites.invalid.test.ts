import { keepAliveReasons, keepAliveTestUrlIgnoredNote, overrideReasons } from '@utils/setAsideReasons'

describe('valid site and keep-alive entries get no set aside reason', () => {
  it('gives no reason for a valid site domain and proxy', () => {
    expect(overrideReasons('a.example', 'good')).toEqual([])
  })

  it('gives no reason for an inactive keep-alive rule with a valid tab URL pattern', () => {
    expect(keepAliveReasons({ active: false, tabUrls: ['example.com'] })).toEqual([])
  })

  it('gives no test URL note when the keep-alive test URL is http or https', () => {
    expect(keepAliveTestUrlIgnoredNote({ active: true, tabUrls: ['example.com'], testProxyUrl: 'https://a.example/' })).toBeUndefined()
  })

  it('gives no test URL note when the keep-alive rule has no test URL', () => {
    expect(keepAliveTestUrlIgnoredNote({ active: true, tabUrls: ['example.com'] })).toBeUndefined()
  })
})
