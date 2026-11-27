import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript } from '@utils/pac'
import { compileRules } from '@utils/storage'
import { evaluatePac } from './pacEvaluation'

const GOOD = 'PROXY good.lan:8080'
const OTHER = 'PROXY other.lan:3128'
const DIRECT = 'DIRECT'
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

const config = {
  proxyList: [
    { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false },
    { id: 'other', type: 'http', host: 'other.lan', port: 3128, proxyDNS: false },
  ] as ProxyListItem[],
  defaultProxy: 'other',
  fallbackDirect: false,
  rules: compileRules([
    {
      active: true,
      name: 'quotes "and" \\ separators',
      match: [`*://*.esc.test/a"b\\c${LINE_SEPARATOR}d`],
      proxyId: 'good',
      bypassUrlPatterns: [`*://bypass.esc.test/${PARAGRAPH_SEPARATOR}// GEO_TEST_START`],
      forceProxyUrlPatterns: ['*://force.esc.test/"'],
    },
  ] as ProxyRule[]),
  perWebsiteOverride: {},
  keepAliveRules: {},
} as unknown as GeoBypassRuntimeSettings

describe('a PAC script built from hostile config text', () => {
  it('keeps line separators out of the script text', () => {
    const script = generatePacScript(config)
    expect(script.includes(LINE_SEPARATOR)).toBe(false)
    expect(script.includes(PARAGRAPH_SEPARATOR)).toBe(false)
  })

  it.each([
    ['a match with quotes, a backslash, and a line separator', 'https://esc.test/x', GOOD],
    ['a bypass with the marker text and a paragraph separator', 'https://bypass.esc.test/x', DIRECT],
    ['a force pattern with a quote', 'https://force.esc.test/x', GOOD],
    ['a host the rule does not name', 'https://other.test/x', OTHER],
  ])('routes %s', (_name, url, expected) => {
    expect(evaluatePac(generatePacScript(config), url)).toBe(expected)
  })
})
