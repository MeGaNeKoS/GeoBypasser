import type { ProxyListItem } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import { proxyId } from '@customTypes/generic'
import { Proxy, WebRequest } from 'webextension-polyfill'
import { matchPatternList } from '@utils/generic'
import { APP_NAME } from '@constant/defaults'
import OnAuthRequiredDetailsTypeChallengerType = WebRequest.OnAuthRequiredDetailsTypeChallengerType

function getProxyById (proxyList: ProxyListItem[], id: string | undefined) {
  return proxyList.find(proxy => proxy.id === id) || null
}

function resolveProxy (config: GeoBypassRuntimeSettings, proxyId?: proxyId) {
  return getProxyById(config.proxyList, proxyId) ||
    getProxyById(config.proxyList, config.defaultProxy)
}

export function makeProxyHandler (config: GeoBypassRuntimeSettings) {
  return async function handleProxyRequest (requestInfo: Proxy.OnRequestDetailsType) {
    for (const rule of config.rules) {
      const {
        proxyId,
        bypassRequestTypes,
        fallbackDirect,
        compiledMatch,
        compiledBypassUrlPatterns,
        compiledForceProxyUrlPatterns,
        compiledStaticExtensions,
        name: ruleName,
        active,
      } = rule
      if (!active) continue

      const url = requestInfo.url

      // --- Main match ---
      if (compiledMatch && !matchPatternList(url, compiledMatch)) continue
      console.info(`[${APP_NAME}Proxy] Rule "${ruleName}" matched for ${url}`)

      // --- Force proxy match ---
      if (compiledForceProxyUrlPatterns && matchPatternList(url, compiledForceProxyUrlPatterns)) {
        const proxy = resolveProxy(config, proxyId)

        if (proxy) {
          console.info(
            `[${APP_NAME}Proxy] Force proxy: Using ${proxy.type} proxy for ${url} -> ${proxy.host}:${proxy.port}`)
          return [
            { ...proxy, proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS },
            ...(fallbackDirect ? [{ type: 'direct' }] : []),
          ]
        } else {
          console.warn(`[${APP_NAME}Proxy] Force proxy: No proxy found for rule "${ruleName}"`)
        }
        return
      }

      // --- Bypass by URL ---
      if (compiledBypassUrlPatterns && matchPatternList(url, compiledBypassUrlPatterns)) {
        console.info(`[${APP_NAME}Proxy] Bypassed by URL pattern for rule "${ruleName}" and url ${url}`)
        return
      }

      // --- Bypass by request type ---
      if (bypassRequestTypes && bypassRequestTypes.includes(requestInfo.type)) {
        console.info(
          `[${APP_NAME}Proxy] Bypassed by request type "${requestInfo.type}" for rule "${ruleName}" and url ${url}`)
        return
      }

      // --- Bypass by static extension ---
      if (compiledStaticExtensions) {
        try {
          if (compiledStaticExtensions.test(new URL(url).pathname)) {
            console.info(`[${APP_NAME}Proxy] Bypassed by static extension for rule "${ruleName}" and url ${url}`)
            return
          }
        } catch (e) {
          console.error(`[${APP_NAME}Proxy] Error parsing URL for static extensions:`, e)
        }
      }

      // --- Use proxy as per rule ---
      const proxy = resolveProxy(config, proxyId)
      if (proxy) {
        console.info(
          `[${APP_NAME}Proxy] Using ${proxy.type} proxy for ${url} -> ${proxy.host}:${proxy.port} (rule "${ruleName}")`)

        return [
          { ...proxy, proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS },
          ...(fallbackDirect ? [{ type: 'direct' }] : []),
        ]

      } else {
        console.warn(`[${APP_NAME}Proxy] No proxy found for rule "${ruleName}"`)
      }
      return
    }
    // If no rule matches, will fall through and not return proxy info
    console.warn(`[${APP_NAME}Proxy] No matching rule for ${requestInfo.url}`)
  }
}

export function makeDefaultProxyHandler (config: GeoBypassSettings) {
  return async () => {
    const proxy = getProxyById(config.proxyList, config.defaultProxy)
    if (proxy) {
      console.info(`[${APP_NAME}Proxy] Default handler: Using ${proxy.type} proxy -> ${proxy.host}:${proxy.port}`)
      return [{ ...proxy }, (config.fallbackDirect ? { type: 'direct' } : {})]
    } else {
      console.warn(`[${APP_NAME}Proxy] Default handler: No default proxy set.`)
    }
  }
}

export function getProxyTypeByChallenger (
  host: OnAuthRequiredDetailsTypeChallengerType['host'],
  port: OnAuthRequiredDetailsTypeChallengerType['port'],
  proxyList: ProxyListItem[]): ProxyListItem | undefined {
  return proxyList.find(proxy =>
    proxy.host === host && proxy.port == port && (proxy.type === 'http' || proxy.type === 'https'),
  )
}
