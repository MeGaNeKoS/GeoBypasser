import type { ProxyListItem } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript, _resetTestPac } from '@utils/pac'
import { pacRouteFor } from '@utils/pacRoute'
import { testProxyConfigQueued } from '@utils/proxy'
import { evaluatePac } from './pacEvaluation'
import { browser } from './setup'

jest.mock('@utils/env', () => ({ supportsProxyOnRequest: false }))

const socksProxy: ProxyListItem = { id: 'socks', type: 'socks', host: 'socks.lan', port: 1080, proxyDNS: true }
const BASE_PAC = 'function FindProxyForURL(url, host) {\n  return "DIRECT";\n}'

function configFor (fallbackDirect: boolean): GeoBypassRuntimeSettings {
  return {
    proxyList: [socksProxy],
    defaultProxy: 'socks',
    fallbackDirect,
    testProxyUrl: 'https://t/',
    rules: [],
    perWebsiteOverride: {},
  }
}

describe('a socks proxy in the generated PAC script', () => {
  it('routes traffic with the SOCKS5 keyword', () => {
    expect(evaluatePac(generatePacScript(configFor(false)), 'https://example.com/')).toBe('SOCKS5 socks.lan:1080')
  })

  it('keeps the SOCKS5 keyword ahead of DIRECT when direct fallback is on', () => {
    expect(evaluatePac(generatePacScript(configFor(true)), 'https://example.com/')).toBe('SOCKS5 socks.lan:1080; DIRECT')
  })
})

describe('the Chrome proxy test for a socks proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    _resetTestPac()
    browser.proxy.settings.get.mockResolvedValue({ value: { pacScript: { data: BASE_PAC } } })
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)
  })

  it('installs its test route with the SOCKS5 keyword', async () => {
    await testProxyConfigQueued(socksProxy, 'https://t/', jest.fn())

    const installedPacs: string[] = browser.proxy.settings.set.mock.calls.map(
      (call: [{ value: { pacScript: { data: string } } }]) => call[0].value.pacScript.data,
    )
    expect(installedPacs.some(pac => pac.includes(`return ${JSON.stringify(pacRouteFor(socksProxy))};`))).toBe(true)
  })
})
