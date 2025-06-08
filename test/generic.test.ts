import { fetchWithTimeout, getHostname, matchHostname, matchPatternList } from '@utils/generic'
import { matchPattern } from 'browser-extension-url-match'

describe('generic utilities', () => {
  it('matchPatternList matches urls', () => {
    const matchers = matchPattern('https://*.example.com/*').assertValid()
    expect(matchPatternList('https://foo.example.com/x', matchers)).toBe(true)
    expect(matchPatternList('https://bar.com', matchers)).toBe(false)
  })

  it('matchHostname wildcard', () => {
    expect(matchHostname('sub.example.com', '*.example.com')).toBe(true)
    expect(matchHostname('example.com', '*.example.com')).toBe(false)
  })

  it('getHostname works', () => {
    expect(getHostname('https://a.com/path')).toBe('a.com')
    expect(getHostname('bad-url')).toBeNull()
  })

  it('fetchWithTimeout resolves and aborts', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any)
    await expect(fetchWithTimeout(new URL('https://a.com'), {}, 50)).resolves.toEqual({ ok: true })

    fetchSpy.mockImplementation((url: any, opts: any) => new Promise((_, reject) => {
      opts.signal?.addEventListener('abort', () => reject(opts.signal.reason))
    }))
    await expect(fetchWithTimeout(new URL('https://a.com'), {}, 5)).rejects.toThrow('Connection timed out')
    fetchSpy.mockRestore()
  })
})
