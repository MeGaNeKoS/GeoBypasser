import { makeOnActiveHandler, makeOnUpdateHandler, maybeUpdateProxyKeepAlive } from '@utils/tab'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem } from '@customTypes/proxy'
import { browser } from './setup'

beforeEach(() => { jest.clearAllMocks() })

const proxy: ProxyListItem = { id: 'p1', type: 'http', host: 'h', port: 80, proxyDNS: true }

function baseConfig (): GeoBypassRuntimeSettings {
  return {
    proxyList: [proxy],
    defaultProxy: undefined,
    fallbackDirect: true,
    testProxyUrl: 'https://t/',
    rules: [],
    perWebsiteOverride: {},
  }
}

describe('maybeUpdateProxyKeepAlive', () => {
  it('starts and stops interval based on active tabs', () => {
    jest.useFakeTimers()
    const state = { activeTabs: new Map([['x', new Set([1])]]), interval: null, testUrl: 'https://t/' }
    const spy = jest.spyOn(require('@utils/tab'), 'keepAliveProxyStatus').mockImplementation(() => {})
    maybeUpdateProxyKeepAlive(proxy, state)
    expect(state.interval).not.toBeNull()
    state.activeTabs.get('x')!.clear()
    maybeUpdateProxyKeepAlive(proxy, state)
    expect(state.interval).toBeNull()
    spy.mockRestore()
    jest.useRealTimers()
  })
})

describe('onUpdate/onActive handlers', () => {
  it('triggers maybeUpdateProxyKeepAlive', async () => {
    const cfg = baseConfig()
    cfg.keepAliveRules = { p1: { active: true, tabUrls: ['example.com'] } }
    const states = { p1: { activeTabs: new Map(), interval: null, testUrl: 'https://t/' } }
    jest.useFakeTimers()
    const onUpdate = makeOnUpdateHandler(cfg, states)
    onUpdate(1, { url: 'https://example.com' } as any, { url: 'https://old.com', discarded: false } as any)
    expect(states.p1.activeTabs.get('example.com')?.has(1)).toBe(true)
    expect(states.p1.interval).not.toBeNull()

    browser.tabs.get.mockResolvedValue({ id: 1, url: 'https://example.com', discarded: false })
    const onActive = makeOnActiveHandler(cfg, states)
    await onActive({ tabId: 1 } as any)
    expect(states.p1.activeTabs.get('example.com')?.has(1)).toBe(true)
    jest.useRealTimers()
  })
})
