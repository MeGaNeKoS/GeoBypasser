import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { resolveProxy } from '@utils/proxy'

function proxyToPac (proxy: ProxyListItem, fallbackDirect: boolean): string {
  const scheme = proxy.type === 'socks' ? 'SOCKS' : 'PROXY'
  return fallbackDirect
    ? `${scheme} ${proxy.host}:${proxy.port}; DIRECT`
    : `${scheme} ${proxy.host}:${proxy.port}`
}

export function generatePacScript (config: GeoBypassRuntimeSettings): string {
  const lines: string[] = []
  lines.push('function FindProxyForURL(url, host) {')

  for (const rule of config.rules) {
    if (!rule.active) continue
    const proxy = rule.proxyId === DIRECT_PROXY_ID ? null : resolveProxy(config, rule.proxyId)
    const pacProxy = proxy ? proxyToPac(proxy, rule.fallbackDirect ?? false) : 'DIRECT'

    if (rule.forceProxyUrlPatterns) {
      for (const pat of rule.forceProxyUrlPatterns) {
        lines.push(`  if (shExpMatch(url, ${JSON.stringify(pat)})) return ${JSON.stringify(pacProxy)};`)
      }
    }
    if (rule.bypassUrlPatterns) {
      for (const pat of rule.bypassUrlPatterns) {
        lines.push(`  if (shExpMatch(url, ${JSON.stringify(pat)})) return "DIRECT";`)
      }
    }
    const matches = Array.isArray(rule.match) ? rule.match : [rule.match]
    for (const pat of matches) {
      lines.push(`  if (shExpMatch(url, ${JSON.stringify(pat)})) return ${JSON.stringify(pacProxy)};`)
    }
  }
  for (const [website, proxyId] of Object.entries(config.perWebsiteOverride || {})) {
    const proxy = resolveProxy(config, proxyId)
    if (proxy) {
      lines.push(`  if (dnsDomainIs(host, ${JSON.stringify(website)})) return ${JSON.stringify(
        proxyToPac(proxy, Boolean(config.fallbackDirect)))};`)
    }
  }
  if (config.defaultProxy) {
    const def = resolveProxy(config, config.defaultProxy)
    if (def) {
      lines.push(`  return ${JSON.stringify(proxyToPac(def, Boolean(config.fallbackDirect)))};`)
    } else {
      lines.push('  return "DIRECT";')
    }
  } else {
    lines.push('  return "DIRECT";')
  }
  lines.push('}')
  return lines.join('\n')
}
