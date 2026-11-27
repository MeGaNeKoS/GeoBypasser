import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript } from '@utils/pac'
import { compileRules } from '@utils/storage'
import { evaluatePac } from './pacEvaluation'

const GOOD = 'PROXY good.lan:8080'

const config = {
  proxyList: [{ id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false }] as ProxyListItem[],
  defaultProxy: null,
  fallbackDirect: false,
  rules: compileRules([
    {
      active: true,
      name: 'image bypass',
      match: ['*://images.example.com/*'],
      proxyId: 'good',
      bypassResourceTypes: ['image'],
    },
  ] as ProxyRule[]),
  perWebsiteOverride: {},
  keepAliveRules: {},
} as unknown as GeoBypassRuntimeSettings

describe('a PAC script for a rule with a resource type bypass', () => {
  it('routes an image request through the rule proxy, since a PAC script cannot see the resource type', () => {
    expect(evaluatePac(generatePacScript(config), 'https://images.example.com/logo.png')).toBe(GOOD)
  })
})
