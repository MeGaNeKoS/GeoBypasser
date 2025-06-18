import { browser } from './setup'
import { DEFAULT_SETTINGS } from '@constant/defaults'
import { compileRules } from '@utils/storage'

jest.mock('@utils/storage', () => {
  const original = jest.requireActual('@utils/storage')
  return {
    ...original,
    getConfig: jest.fn(async () => ({
      ...DEFAULT_SETTINGS,
      proxyList: [{ id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true }],
      rules: compileRules([{ active: true, name: 'r', match: ['<all_urls>'], proxyId: 'p1' }]),
      keepAliveRules: { p1: { active: true, tabUrls: ['example.com'] } },
    })),
    getTabProxyMap: jest.fn(async () => ({})),
  }
})

jest.mock('@utils/tab', () => {
  const original = jest.requireActual('@utils/tab')
  return { ...original, maybeUpdateProxyKeepAlive: jest.fn() }
})

describe('background init', () => {
  it('attaches handlers and keep-alive', async () => {
    await import('../src/background.firefox')
    await Promise.resolve()
    await Promise.resolve()
    expect(browser.proxy.onRequest._listeners.length).toBeGreaterThan(0)
    const tabUtils = require('@utils/tab')
    expect(tabUtils.maybeUpdateProxyKeepAlive).toHaveBeenCalled()
  })
})
