import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { resolveProxy } from '@utils/proxy'
import { pacRouteFor } from '@utils/pacRoute'
import { matchPatternSource } from '@utils/pacPattern'
import { compileStaticExtensions } from '@utils/validity'
import { isRuleActive, overridesMostSpecificFirst, usableOverrides, usableRules } from '@utils/usable'
import browser from 'webextension-polyfill'

const PAC_HEADER = 'function FindProxyForURL(url, host) {'
export const DIRECT_ROUTE = 'DIRECT'
const PAC_PATH_EXPRESSION = 'url.replace(/^[a-z]+:\\/\\/[^\\/]*/i, "").replace(/[?#].*$/, "")'
// Chrome gives the PAC script only scheme://host:port/ for https addresses, so a path check can only see http.
const PAC_HTTP_PREFIX = 'http://'
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

export function proxyToPac (proxy: ProxyListItem, fallbackDirect: boolean): string {
  const route = pacRouteFor(proxy)
  return fallbackDirect ? `${route}; DIRECT` : route
}

function pacString (text: string): string {
  return JSON.stringify(text)
    .split(LINE_SEPARATOR).join('\\u2028')
    .split(PARAGRAPH_SEPARATOR).join('\\u2029')
}

export function generatePacScript (config: GeoBypassRuntimeSettings): string {
  return [
    PAC_HEADER,
    ...overrideLines(config),
    ...usableRules(config.rules).filter(isRuleActive).flatMap(rule => ruleBlock(config, rule)),
    defaultRouteLine(config),
    '}',
  ].join('\n')
}

function overrideLines (config: GeoBypassRuntimeSettings): string[] {
  return overridesMostSpecificFirst(usableOverrides(config.perWebsiteOverride)).flatMap(([domain, proxyId]) => {
    const proxy = resolveProxy(config, proxyId)
    return proxy ? [overrideLine(domain, proxyToPac(proxy, Boolean(config.fallbackDirect)))] : []
  })
}

function overrideLine (domain: string, pacProxy: string): string {
  const name = domain.toLowerCase()
  return `  if (host == ${pacString(name)} || dnsDomainIs(host, ${pacString('.' + name)})) ` +
    `return ${pacString(pacProxy)};`
}

function ruleBlock (config: GeoBypassRuntimeSettings, rule: ProxyRule): string[] {
  const pacProxy = rulePacProxy(config, rule)
  return [
    `  if (${anyPatternMatches(rule.match)}) {`,
    ...routeWhenMatching(rule.forceProxyUrlPatterns, pacProxy),
    ...routeWhenMatching(rule.bypassUrlPatterns, DIRECT_ROUTE),
    ...staticExtensionLines(rule.staticExtensions),
    `    return ${pacString(pacProxy)};`,
    '  }',
  ]
}

function rulePacProxy (config: GeoBypassRuntimeSettings, rule: ProxyRule): string {
  if (rule.proxyId === DIRECT_PROXY_ID) return DIRECT_ROUTE
  const proxy = resolveProxy(config, rule.proxyId)
  return proxy ? proxyToPac(proxy, rule.fallbackDirect ?? false) : DIRECT_ROUTE
}

function routeWhenMatching (patterns: string[] | undefined, route: string): string[] {
  if (!patterns?.length) return []
  return [`    if (${anyPatternMatches(patterns)}) return ${pacString(route)};`]
}

function staticExtensionLines (staticExtensions: string | undefined): string[] {
  const extensions = compileStaticExtensions(staticExtensions)
  if (!extensions) return []
  return [
    `    if (url.indexOf(${pacString(PAC_HTTP_PREFIX)}) == 0 && new RegExp(${pacString(extensions.source)}, ` +
    `${pacString(extensions.flags)}).test(${PAC_PATH_EXPRESSION})) return ${pacString(DIRECT_ROUTE)};`,
  ]
}

function anyPatternMatches (patterns: string[]): string {
  return patterns
    .map(pattern => `new RegExp(${pacString(matchPatternSource(pattern))}).test(url)`)
    .join(' || ')
}

function defaultRouteLine (config: GeoBypassRuntimeSettings): string {
  const proxy = config.defaultProxy ? resolveProxy(config, config.defaultProxy) : null
  const route = proxy ? proxyToPac(proxy, Boolean(config.fallbackDirect)) : DIRECT_ROUTE
  return `  return ${pacString(route)};`
}

const TEST_START = '// GEO_TEST_START'
const TEST_END = '// GEO_TEST_END'
let basePac: string | null = null
const testUrls = new Map<string, { proxy: string; count: number }>()

export function _resetTestPac () {
  basePac = null
  testUrls.clear()
}

function buildPacWithTests (): string {
  if (!basePac) return ''
  const lines = basePac.split('\n')
  const start = lines.findIndex(l => l.trim() === TEST_START)
  const end = lines.findIndex(l => l.trim() === TEST_END)
  if (start !== -1 && end !== -1) {
    lines.splice(start, end - start + 1)
  }
  if (testUrls.size === 0) return basePac
  const testLines: string[] = []
  testLines.push(`  ${TEST_START}`)
  for (const [url, { proxy }] of testUrls.entries()) {
    testLines.push(`  if (url == ${JSON.stringify(url)}) return ${JSON.stringify(proxy)};`)
  }
  testLines.push(`  ${TEST_END}`)
  const insertIdx = lines.findIndex(l => l.trimEnd().endsWith('{')) + 1
  lines.splice(insertIdx, 0, ...testLines)
  return lines.join('\n')
}

export async function addTestURLToPac (
  url: string,
  pacProxy: string,
): Promise<() => Promise<void>> {
  const prev = await browser.proxy.settings.get({})

  let pac: string | undefined

  if (
    typeof prev === 'object' &&
    prev !== null &&
    'value' in prev &&
    typeof prev.value === 'object' &&
    prev.value !== null &&
    'pacScript' in prev.value &&
    typeof prev.value.pacScript === 'object' &&
    prev.value.pacScript !== null &&
    'data' in prev.value.pacScript &&
    typeof prev.value.pacScript.data === 'string'
  ) {
    pac = prev.value.pacScript.data
  }

  if (basePac == null) {
    basePac = pac || 'function FindProxyForURL(url, host) {\n  return "DIRECT";\n}'
  }

  if (testUrls.has(url)) {
    const entry = testUrls.get(url)!
    entry.count++
  } else {
    testUrls.set(url, { proxy: pacProxy, count: 1 })
  }

  const newPac = buildPacWithTests()

  await browser.proxy.settings.set({
    value: { mode: 'pac_script', pacScript: { data: newPac } },
  })

  return async () => {
    await removeTestURLFromPac(url)
  }
}

export async function removeTestURLFromPac (url: string): Promise<void> {
  const entry = testUrls.get(url)
  if (!entry) return
  if (entry.count > 1) {
    entry.count--
    return
  }
  testUrls.delete(url)
  if (testUrls.size === 0) {
    if (basePac !== null) {
      await browser.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: basePac } } })
    }
    basePac = null
    return
  }
  const newPac = buildPacWithTests()
  await browser.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: newPac } } })
}
