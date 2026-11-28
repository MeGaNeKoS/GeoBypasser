import type { ProxyListItem, ProxyTestResult, RuntimeProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import { ProxyId } from '@customTypes/generic'
import browser, { Proxy, Tabs, WebRequest } from 'webextension-polyfill'
import { fetchWithTimeout, getHostname, isHostOrSubdomain, matchPatternList } from '@utils/generic'
import { isInRuleScope } from '@utils/ruleScope'
import { APP_NAME } from '@constant/defaults'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { supportsProxyOnRequest } from '@utils/env'
import { addTestURLToPac } from '@utils/pac'
import { pacRouteFor } from '@utils/pacRoute'
import { isRuleActive, overridesMostSpecificFirst, usableOverrides, usableProxies, usableRules } from '@utils/usable'
import { isValidFailoverTimeout } from '@utils/validity'
import { testFailureReason } from '@utils/proxyTestOutcome'
import OnAuthRequiredDetailsTypeChallengerType = WebRequest.OnAuthRequiredDetailsTypeChallengerType
import OnAuthRequiredDetailsType = WebRequest.OnAuthRequiredDetailsType

type ProxyTestJob = {
  proxy: ProxyListItem;
  testUrl: string;
  sendResult: (result: ProxyTestResult) => void;
}
const proxyTestQueues = new Map<string, Array<ProxyTestJob>>()
const proxyTestRunning = new Set<string>()

function getProxyById (proxyList: ProxyListItem[], id: string | undefined) {
  return usableProxies(proxyList).find(proxy => proxy.id === id) || null
}

export function resolveProxy (config: GeoBypassRuntimeSettings, proxyId?: ProxyId) {
  return getProxyById(config.proxyList, proxyId) ||
    getProxyById(config.proxyList, config.defaultProxy)
}

const HTTP_AUTH_FAILOVER_TIMEOUT_SECONDS = 30
const DEFAULT_FAILOVER_TIMEOUT_SECONDS = 3

function isAuthenticatedHttp (proxy: ProxyListItem): boolean {
  return proxy.type === 'http' && !!proxy.username
}

export function failoverTimeoutFor (proxy: ProxyListItem): number | undefined {
  if (proxy.failoverTimeout === undefined) {
    return isAuthenticatedHttp(proxy) ? HTTP_AUTH_FAILOVER_TIMEOUT_SECONDS : DEFAULT_FAILOVER_TIMEOUT_SECONDS
  }
  return isValidFailoverTimeout(proxy.failoverTimeout) ? proxy.failoverTimeout : undefined
}

export function proxyInfoFor (proxy: ProxyListItem) {
  const { failoverTimeout, ...rest } = proxy
  return {
    ...rest,
    proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS,
    ...(isValidFailoverTimeout(failoverTimeout) ? { failoverTimeout } : {}),
  }
}

export function makeTabProxyHandler (
  config: GeoBypassRuntimeSettings,
  tabProxyMap: Record<number, ProxyId> = {},
) {
  return async function handleTabProxyRequest (requestInfo: Proxy.OnRequestDetailsType) {
    if (requestInfo.tabId === undefined) return
    const mapped = tabProxyMap[requestInfo.tabId]
    if (!mapped) return
    const proxy = resolveProxy(config, mapped)
    if (proxy) {
      console.info(`[${APP_NAME}Proxy] Tab ${requestInfo.tabId} mapped to proxy ${mapped}`)
      return [
        proxyInfoFor(proxy),
        ...(config.fallbackDirect ? [{ type: 'direct' }] : []),
      ]
    }
  }
}

function overrideProxyIdForHost (overrides: unknown, hostname: string): string | undefined {
  return overridesMostSpecificFirst(usableOverrides(overrides))
    .find(([domain]) => isHostOrSubdomain(hostname, domain.toLowerCase()))?.[1]
}

export type TabLookup = (tabId: number) => Promise<Pick<Tabs.Tab, 'url'>>

export function makeDomainProxyHandler (config: GeoBypassRuntimeSettings, lookupTab: TabLookup) {
  return async function handleDomainProxyRequest (requestInfo: Proxy.OnRequestDetailsType) {
    if (requestInfo.tabId === undefined) return
    let tab
    try {
      tab = await lookupTab(requestInfo.tabId)
    } catch {
      return
    }
    if (!tab.url) return
    const hostname = getHostname(tab.url)
    if (!hostname) return
    const overrideId = overrideProxyIdForHost(config.perWebsiteOverride, hostname)
    if (overrideId) {
      const proxy = resolveProxy(config, overrideId)
      if (proxy) {
        console.info(`[${APP_NAME}Proxy] Domain override for "${hostname}" matched for tab ${requestInfo.tabId}`)
        return [
          proxyInfoFor(proxy),
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
    for (const rule of usableRules<RuntimeProxyRule>(config.rules)) {
      const {
        proxyId,
        bypassResourceTypes,
        fallbackDirect,
        compiledMatch,
        compiledBypassUrlPatterns,
        compiledForceProxyUrlPatterns,
        compiledStaticExtensions,
        name: ruleName,
      } = rule
      if (!isRuleActive(rule)) continue

      const url = requestInfo.url

      // --- Main match ---
      if (compiledMatch && !matchPatternList(url, compiledMatch)) continue
      console.info(`[${APP_NAME}Proxy] Rule "${ruleName}" matched for ${url}`)

      // --- Force proxy match ---
      if (compiledForceProxyUrlPatterns && matchPatternList(url, compiledForceProxyUrlPatterns)) {
        if (proxyId === DIRECT_PROXY_ID) {
          console.info(`[${APP_NAME}Proxy] Force direct connection for ${url} (rule "${ruleName}")`)
          return [{ type: 'direct' }]
        }
        const proxy = resolveProxy(config, proxyId)
        if (proxy) {
          console.info(
            `[${APP_NAME}Proxy] Force proxy: Using ${proxy.type} proxy for ${url} -> ${proxy.host}:${proxy.port}`)
          return [
            proxyInfoFor(proxy),
            ...(fallbackDirect ? [{ type: 'direct' }] : []),
          ]
        } else {
          console.warn(`[${APP_NAME}Proxy] Force proxy: No proxy found for rule "${ruleName}"`)
        }
        return
      }

      if (!isInRuleScope(requestInfo, rule)) {
        console.info(`[${APP_NAME}Proxy] Outside the scope of rule "${ruleName}", direct connection for ${url}`)
        return [{ type: 'direct' }]
      }

      // --- Bypass by URL ---
      if (compiledBypassUrlPatterns && matchPatternList(url, compiledBypassUrlPatterns)) {
        console.info(`[${APP_NAME}Proxy] Bypassed by URL pattern for rule "${ruleName}" and url ${url}`)
        return [{ type: 'direct' }]
      }

      // --- Bypass by request type ---
      if (bypassResourceTypes && bypassResourceTypes.includes(requestInfo.type)) {
        console.info(
          `[${APP_NAME}Proxy] Bypassed by request type "${requestInfo.type}" for rule "${ruleName}" and url ${url}`)
        return [{ type: 'direct' }]
      }

      // --- Bypass by static extension ---
      if (compiledStaticExtensions) {
        try {
          compiledStaticExtensions.lastIndex = 0
          if (compiledStaticExtensions.test(new URL(url).pathname)) {
            console.info(`[${APP_NAME}Proxy] Bypassed by static extension for rule "${ruleName}" and url ${url}`)
            return [{ type: 'direct' }]
          }
        } catch (e) {
          console.error(`[${APP_NAME}Proxy] Error parsing URL for static extensions:`, e)
        }
      }
      // --- Direct connection ---
      if (proxyId === DIRECT_PROXY_ID) {
        console.info(`[${APP_NAME}Proxy] Using direct connection for ${url} (rule "${ruleName}")`)
        return [{ type: 'direct' }]
      }

      // --- Use proxy as per rule ---
      const proxy = resolveProxy(config, proxyId)
      if (proxy) {
        console.info(
          `[${APP_NAME}Proxy] Using ${proxy.type} proxy for ${url} -> ${proxy.host}:${proxy.port} (rule "${ruleName}")`)

        return [
          proxyInfoFor(proxy),
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
        proxyInfoFor(proxy),
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
  return usableProxies(proxyList).find(proxy =>
    proxy.host === host && proxy.port == port && proxy.type === 'http',
  )
}

export function authCredentialsFor (
  details: Pick<OnAuthRequiredDetailsType, 'isProxy' | 'challenger'>,
  proxyList: ProxyListItem[],
): { username: string; password: string } | undefined {
  if (!details.isProxy) return undefined
  const proxy = getProxyTypeByChallenger(details.challenger.host, details.challenger.port, proxyList)
  if (!proxy) return undefined
  return { username: proxy.username || '', password: proxy.password || '' }
}

async function testProxyConfig (
  proxy: ProxyListItem, testUrl: string, sendResult: (result: ProxyTestResult) => void) {
  let restore: (() => Promise<void>) | null = null
  let testProxyHandler: ((requestInfo: Proxy.OnRequestDetailsType) => any) | null = null

  if (!supportsProxyOnRequest) {
    restore = await addTestURLToPac(testUrl, pacRouteFor(proxy))
  } else {
    testProxyHandler = function (requestInfo: Proxy.OnRequestDetailsType) {
      console.debug(
        `[${APP_NAME}Proxy] Testing proxy [${proxy.type}] ${proxy.host}:${proxy.port} for URL: ${requestInfo.url}`)
      return {
        type: proxy.type,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        proxyDNS: proxy.type === 'http' ? false : proxy.proxyDNS,
        failoverTimeout: failoverTimeoutFor(proxy),
      }
    }
    browser.proxy.onRequest.addListener(testProxyHandler, { urls: [testUrl] })
    restore = async () => { browser.proxy.onRequest.removeListener(testProxyHandler!) }
  }
  try {
    const res = await fetchWithTimeout(new URL(testUrl), { method: 'HEAD', cache: 'no-store' },
      isAuthenticatedHttp(proxy) ? 30_000 : 5_000)
    let result
    if (res.ok) {
      result = { success: true }
    } else {
      result = { success: false, error: `HTTP error: ${res.status}` }
    }
    sendResult({ ...result, proxy: `${proxy.host}:${proxy.port}` } as ProxyTestResult)
  } catch (err) {
    console.log(err)
    sendResult({ success: false, error: testFailureReason(err), proxy: `${proxy.host}:${proxy.port}` })
  } finally {
    if (restore) await restore()
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
  const job: ProxyTestJob = { proxy: { ...proxy, host: proxy.host.trim() }, testUrl, sendResult }
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
