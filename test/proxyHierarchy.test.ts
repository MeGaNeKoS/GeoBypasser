import {
  makeTabProxyHandler,
  makeDomainProxyHandler,
  makeProxyHandler,
  makeDefaultProxyHandler,
} from '@utils/proxy'
import { compileRules } from '@utils/storage'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem } from '@customTypes/proxy'
import { browser } from './setup'

const proxies: Record<string, ProxyListItem> = {
  p1: { id: 'p1', type: 'http', host: '1', port: 80, proxyDNS: true },
  p2: { id: 'p2', type: 'http', host: '2', port: 80, proxyDNS: true },
  p3: { id: 'p3', type: 'http', host: '3', port: 80, proxyDNS: true },
  p4: { id: 'p4', type: 'http', host: '4', port: 80, proxyDNS: true },
  p5: { id: 'p5', type: 'http', host: '5', port: 80, proxyDNS: true },
}

function baseConfig (def: string | null | undefined = 'p2'): GeoBypassRuntimeSettings {
  return {
    proxyList: Object.values(proxies),
    defaultProxy: def === null ? undefined : def,
    fallbackDirect: true,
    testProxyUrl: 'https://t/',
    rules: compileRules([
      { active: true, name: 'RuleExt', match: ['*://*.external.org/*'], proxyId: 'p4' },
      {
        active: true,
        name: 'RuleOther',
        match: ['*://*.othersite.com/*'],
        proxyId: 'p5',
        staticExtensions: '/\\.(png|jpg|css|js)$/',
      },
    ]),
    perWebsiteOverride: { 'example.com': 'p3' },
  }
}

async function runRequest (
  cfg: GeoBypassRuntimeSettings,
  tabId: number,
  tabUrl: string,
  reqUrl: string,
  type: any = 'script',
  tabMap: Record<number, string> = {},
) {
  const tabHandler = makeTabProxyHandler(cfg, tabMap)
  const domainHandler = makeDomainProxyHandler(cfg)
  const ruleHandler = makeProxyHandler(cfg)
  const defaultHandler = cfg.defaultProxy ? makeDefaultProxyHandler(cfg) : undefined
  const info: any = { tabId, url: reqUrl, type }

  let res = await tabHandler(info)
  if (!res) {
    browser.tabs.get.mockResolvedValue({ id: tabId, url: tabUrl })
    res = await domainHandler(info)
  }
  if (!res) res = await ruleHandler(info)
  if (!res && defaultHandler) res = await defaultHandler()
  return res as any
}

describe('proxy hierarchy scenarios', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('1. tab rule takes priority', async () => {
    const cfg = baseConfig()
    const res = await runRequest(cfg, 1, 'https://example.com', 'https://external.org/api', 'script', { 1: 'p1' })
    expect(res[0].id).toBe('p1')
  })

  it('2. domain override beats rule', async () => {
    const cfg = baseConfig()
    const res = await runRequest(cfg, 2, 'https://example.com', 'https://external.org/api')
    expect(res[0].id).toBe('p3')
  })

  it('3. rule applied when no override', async () => {
    const cfg = baseConfig()
    const res = await runRequest(cfg, 3, 'https://othersite.com', 'https://external.org/api')
    expect(res[0].id).toBe('p4')
  })

  it('4. default proxy when nothing matches', async () => {
    const cfg = baseConfig()
    const res = await runRequest(cfg, 4, 'https://nomatch.example', 'https://nomatch.example')
    expect(res[0].id).toBe('p2')
  })

  it('5. direct connection if default absent', async () => {
    const cfg = baseConfig(null)
    const res = await runRequest(cfg, 4, 'https://nomatch.example', 'https://nomatch.example')
    expect(res).toBeUndefined()
  })

  it('6. rule bypass for static assets', async () => {
    const cfg = baseConfig()
    const res = await runRequest(cfg, 3, 'https://othersite.com', 'https://othersite.com/image.png')
    expect(res[0].id).toBe('p2')
  })

  it('7. force-proxy pattern', async () => {
    const cfg = baseConfig()
    const rules = [
      { active: true, name: 'RuleExt', match: ['*://*.external.org/*'], proxyId: 'p4' },
      {
        active: true,
        name: 'RuleOther',
        match: ['<all_urls>'],
        proxyId: 'p5',
        staticExtensions: '/\\.(png|jpg|css|js)$/',
        forceProxyUrlPatterns: ['*://*.force.me/*'],
      },
    ]
    cfg.rules = compileRules(rules)
    const res = await runRequest(cfg, 3, 'https://othersite.com', 'https://cdn.force.me/file.js')
    expect(res[0].id).toBe('p5')
  })

  it('8. invalid tab mapping uses default', async () => {
    const cfg = baseConfig()
    const res = await runRequest(cfg, 5, 'https://example.com', 'https://external.org/api', 'script', { 5: 'missing' })
    expect(res[0].id).toBe('p2')
  })

  it('9. domain override missing proxy warns and falls through', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const cfg = baseConfig(null)
    cfg.perWebsiteOverride['missing.com'] = 'missing'
    const res = await runRequest(cfg, 6, 'https://missing.com', 'https://missing.com')
    expect(res).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
