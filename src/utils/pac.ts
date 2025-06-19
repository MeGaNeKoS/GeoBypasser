import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyListItem } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { resolveProxy } from '@utils/proxy'
import browser from 'webextension-polyfill'

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
  const start = lines.findIndex(l => l.includes(TEST_START))
  const end = lines.findIndex(l => l.includes(TEST_END))
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
  const insertIdx = lines.findIndex(l => l.includes('{')) + 1
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
