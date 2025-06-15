import type { ProxyListItem, ProxyTestResult } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import { proxyId } from '@customTypes/generic'
import browser, { Proxy, WebRequest } from 'webextension-polyfill'
import { fetchWithTimeout, getHostname, matchPatternList } from '@utils/generic'
import { APP_NAME } from '@constant/defaults'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import OnAuthRequiredDetailsTypeChallengerType = WebRequest.OnAuthRequiredDetailsTypeChallengerType

type ProxyTestJob = {
  proxy: ProxyListItem;
  testUrl: string;
  sendResult: (result: ProxyTestResult) => void;
}
const proxyTestQueues = new Map<string, Array<ProxyTestJob>>()
const proxyTestRunning = new Set<string>()

function getProxyById (proxyList: ProxyListItem[], id: string | undefined) {
  return proxyList.find(proxy => proxy.id === id) || null
}

export function resolveProxy (config: GeoBypassRuntimeSettings, proxyId?: proxyId) {
  return getProxyById(config.proxyList, proxyId) ||
    getProxyById(config.proxyList, config.defaultProxy)
}

export function makeTabProxyHandler (
  config: GeoBypassRuntimeSettings,
  tabProxyMap: Record<number, proxyId> = {},
) {
  return async function handleTabProxyRequest (requestInfo: Proxy.OnRequestDetailsType) {
    if (requestInfo.tabId === undefined) return
    const mapped = tabProxyMap[requestInfo.tabId]
    if (!mapped) return
    const proxy = resolveProxy(config, mapped)
    if (proxy) {
      console.info(`[${APP_NAME}Proxy] Tab ${requestInfo.tabId} mapped to proxy ${mapped}`)
      return [
        { ...proxy, proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS },
        ...(config.fallbackDirect ? [{ type: 'direct' }] : []),
      ]
    }
  }
}

export function makeDomainProxyHandler (config: GeoBypassRuntimeSettings) {
  return async function handleDomainProxyRequest (requestInfo: Proxy.OnRequestDetailsType) {
    if (requestInfo.tabId === undefined) return
    let tab
    try {
      tab = await browser.tabs.get(requestInfo.tabId)
    } catch {
      return
    }
    if (!tab.url) return
    const hostname = getHostname(tab.url)
    if (!hostname) return
    const overrideId = config.perWebsiteOverride?.[hostname]
    if (overrideId) {
      const proxy = resolveProxy(config, overrideId)
      if (proxy) {
        console.info(`[${APP_NAME}Proxy] Domain override for "${hostname}" matched for tab ${requestInfo.tabId}`)
        return [
          { ...proxy, proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS },
          ...(config.fallbackDirect ? [{ type: 'direct' }] : []),
        ]
      } else {
        console.warn(`[${APP_NAME}Proxy] Domain override proxy not found for "${hostname}"`)
      }
    }
  }
}

export function makeProxyHandler (
  config: GeoBypassRuntimeSettings,
) {
  return async function handleProxyRequest (requestInfo: Proxy.OnRequestDetailsType) {
    for (const rule of config.rules) {
      const {
        proxyId,
        bypassResourceTypes,
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
        if (proxyId === DIRECT_PROXY_ID) {
          console.info(`[${APP_NAME}Proxy] Force direct connection for ${url} (rule "${ruleName}")`)
          return [{ type: "direct" }]
        }
        const proxy = resolveProxy(config, proxyId)
        if (proxy) {
          console.info(`[${APP_NAME}Proxy] Force proxy: Using ${proxy.type} proxy for ${url} -> ${proxy.host}:${proxy.port}`)
          return [
            { ...proxy, proxyDNS: proxy.type === "http" ? false : proxy.proxyDNS },
            ...(fallbackDirect ? [{ type: "direct" }] : [])
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
      if (bypassResourceTypes && bypassResourceTypes.includes(requestInfo.type)) {
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
      // --- Direct connection ---
      if (proxyId === DIRECT_PROXY_ID) {
        console.info(`[${APP_NAME}Proxy] Using direct connection for ${url} (rule "${ruleName}")`)
        return [{ type: "direct" }]
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
      return [
        { ...proxy, proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS },
        ...(config.fallbackDirect ? [{ type: 'direct' }] : []),
      ]
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
    proxy.host === host && proxy.port == port && proxy.type === 'http',
  )
}

async function testProxyConfig (
  proxy: ProxyListItem, testUrl: string, sendResult: (result: ProxyTestResult) => void) {
  function testProxyHandler (requestInfo: Proxy.OnRequestDetailsType) {
    console.debug(`[${APP_NAME}Proxy] Testing proxy ${proxy.host}:${proxy.port} for URL: ${requestInfo.url}`)
    return {
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS,
      failoverTimeout: proxy.failoverTimeout || 3, // Default to 3 seconds if not set
    }
  }

  browser.proxy.onRequest.addListener(
    testProxyHandler,
    { urls: [testUrl] },
  )
  try {
    const res = await fetchWithTimeout(new URL(testUrl), { method: 'HEAD', cache: 'no-store' }, 5000)
    let result
    if (res.ok) {
      result = { success: true }
    } else {
      result = { success: false, error: `HTTP error: ${res.status}` }
    }
    sendResult({ ...result, proxy: `${proxy.host}:${proxy.port}` } as ProxyTestResult)
  } catch (err) {
    console.log(err)
    // check if the error is an AbortError
    if (err instanceof Error) {
      const userError = err.message
      sendResult({ success: false, error: userError, proxy: `${proxy.host}:${proxy.port}` })
    }
  } finally {
    browser.proxy.onRequest.removeListener(testProxyHandler)
  }
}

export async function testProxyConfigQueued (
  proxy: ProxyListItem,
  testUrl: string,
  sendResult: (result: ProxyTestResult) => void,
) {
  // Init queue if not present
  if (!proxyTestQueues.has(testUrl)) proxyTestQueues.set(testUrl, [])

  const queue = proxyTestQueues.get(testUrl)!
  const job: ProxyTestJob = { proxy, testUrl, sendResult }
  queue.push(job)

  // If already running, just queue the job
  if (proxyTestRunning.has(testUrl)) {
    console.debug(`[${APP_NAME}Proxy] Queued test for ${testUrl} (now ${queue.length} queued)`)
    return
  }

  // Otherwise, start processing
  proxyTestRunning.add(testUrl)

  while (queue.length > 0) {
    const currentJob = queue.shift()!
    try {
      await testProxyConfig(currentJob.proxy, currentJob.testUrl, currentJob.sendResult)
    } catch (e) {
      console.error(`[${APP_NAME}Proxy] Error during proxy test for ${currentJob.testUrl}`, e)
    }
  }
  // Done: clear running marker
  proxyTestRunning.delete(testUrl)
}
