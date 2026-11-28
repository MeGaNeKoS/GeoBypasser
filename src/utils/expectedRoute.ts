import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyRule } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { resolveProxy } from '@utils/proxy'
import { DIRECT_ROUTE, proxyToPac } from '@utils/pac'
import { matchPatternSource } from '@utils/pacPattern'
import { compileStaticExtensions } from '@utils/validity'
import { isRuleActive, overridesMostSpecificFirst, usableOverrides, usableRules } from '@utils/usable'

export type RouteReason = 'site' | 'rule' | 'bypass' | 'staticExtension' | 'default'

export type RuleRef = {
  index: number;
  name: string;
};

export type ExpectedRoute = {
  route: string;
  reason: RouteReason;
  rule?: RuleRef;
};

const HTTPS_SCHEME = 'https:'
const HTTP_PREFIX = 'http://'
const SCHEME_AND_HOST = /^[a-z]+:\/\/[^/]*/i
const QUERY_AND_FRAGMENT = /[?#].*$/

export function expectedRoute (config: GeoBypassRuntimeSettings, url: string): ExpectedRoute {
  const host = new URL(url).hostname
  const seenUrl = chromePacInput(url)
  return siteRoute(config, host) ??
    ruleRoute(config, seenUrl) ??
    defaultRoute(config)
}

function chromePacInput (url: string): string {
  const parsed = new URL(url)
  return parsed.protocol === HTTPS_SCHEME ? `${parsed.protocol}//${parsed.host}/` : url
}

function siteRoute (config: GeoBypassRuntimeSettings, host: string): ExpectedRoute | undefined {
  for (const [domain, proxyId] of overridesMostSpecificFirst(usableOverrides(config.perWebsiteOverride))) {
    const proxy = resolveProxy(config, proxyId)
    if (proxy && isHostForDomain(host, domain.toLowerCase())) {
      return { route: proxyToPac(proxy, Boolean(config.fallbackDirect)), reason: 'site' }
    }
  }
  return undefined
}

function isHostForDomain (host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function ruleRoute (config: GeoBypassRuntimeSettings, seenUrl: string): ExpectedRoute | undefined {
  const rule = usableRules(config.rules).filter(isRuleActive).find(candidate => matchesAny(candidate.match, seenUrl))
  if (!rule) return undefined
  return ruleOutcome(config, rule, seenUrl)
}

function ruleOutcome (config: GeoBypassRuntimeSettings, rule: ProxyRule, seenUrl: string): ExpectedRoute {
  const ref = { index: config.rules.indexOf(rule), name: rule.name }
  const proxyRoute = rulePacRoute(config, rule)
  if (matchesAny(rule.forceProxyUrlPatterns ?? [], seenUrl)) return { route: proxyRoute, reason: 'rule', rule: ref }
  if (matchesAny(rule.bypassUrlPatterns ?? [], seenUrl)) return { route: DIRECT_ROUTE, reason: 'bypass', rule: ref }
  if (isStaticExtension(rule.staticExtensions, seenUrl)) return { route: DIRECT_ROUTE, reason: 'staticExtension', rule: ref }
  return { route: proxyRoute, reason: 'rule', rule: ref }
}

function rulePacRoute (config: GeoBypassRuntimeSettings, rule: ProxyRule): string {
  if (rule.proxyId === DIRECT_PROXY_ID) return DIRECT_ROUTE
  const proxy = resolveProxy(config, rule.proxyId)
  return proxy ? proxyToPac(proxy, rule.fallbackDirect ?? false) : DIRECT_ROUTE
}

function isStaticExtension (staticExtensions: string | undefined, seenUrl: string): boolean {
  const extensions = compileStaticExtensions(staticExtensions)
  if (!extensions) return false
  if (!seenUrl.startsWith(HTTP_PREFIX)) return false
  return extensions.test(seenUrl.replace(SCHEME_AND_HOST, '').replace(QUERY_AND_FRAGMENT, ''))
}

function matchesAny (patterns: string[], seenUrl: string): boolean {
  return patterns.some(pattern => new RegExp(matchPatternSource(pattern)).test(seenUrl))
}

function defaultRoute (config: GeoBypassRuntimeSettings): ExpectedRoute {
  const proxy = config.defaultProxy ? resolveProxy(config, config.defaultProxy) : null
  const route = proxy ? proxyToPac(proxy, Boolean(config.fallbackDirect)) : DIRECT_ROUTE
  return { route, reason: 'default' }
}
