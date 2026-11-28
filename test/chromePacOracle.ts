import vm from 'node:vm'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import { generatePacScript } from '@utils/pac'
import { compileRules } from '@utils/storage'

export const PROXY_GOOD = 'PROXY good.lan:8080'
export const PROXY_OTHER = 'PROXY other.lan:9090'
export const DIRECT = 'DIRECT'

const proxyList = [
  { id: 'good', type: 'http', host: 'good.lan', port: 8080, proxyDNS: false },
  { id: 'other', type: 'http', host: 'other.lan', port: 9090, proxyDNS: false },
] as ProxyListItem[]

type SettingsParts = {
  rules?: ProxyRule[]
  overrides?: Record<string, string>
  defaultProxy?: string | null
  fallbackDirect?: boolean
}

export function settingsFor (parts: SettingsParts = {}): GeoBypassRuntimeSettings {
  return {
    proxyList,
    defaultProxy: parts.defaultProxy ?? null,
    fallbackDirect: parts.fallbackDirect ?? false,
    rules: compileRules(parts.rules ?? []),
    perWebsiteOverride: parts.overrides ?? {},
    keepAliveRules: {},
  } as unknown as GeoBypassRuntimeSettings
}

function chromePacInput (url: string): string {
  const parsed = new URL(url)
  return parsed.protocol === 'https:' ? `${parsed.protocol}//${parsed.host}/` : url
}

export function pacRouteOracle (settings: GeoBypassRuntimeSettings, url: string): string {
  const sandbox = {
    dnsDomainIs: (host: string, domain: string) => host.endsWith(domain),
    url: chromePacInput(url),
    host: new URL(url).hostname,
    route: '',
  }
  vm.runInNewContext(`${generatePacScript(settings)}\nroute = FindProxyForURL(url, host);`, sandbox)
  return sandbox.route
}
