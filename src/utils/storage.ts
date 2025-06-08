import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import browser from 'webextension-polyfill'
import type { storageMode } from '@customTypes/generic'
import { APP_NAME, DEFAULT_SETTINGS } from '@constant/defaults'
import { STORAGE_KEYS, STORAGE_MODE } from '@constant/storageKeys'

import type { RuntimeProxyRule } from '@customTypes/proxy'
import { matchPattern } from 'browser-extension-url-match'

export async function getUserStorageMode (): Promise<storageMode> {
  const result = await browser.storage.local.get(STORAGE_MODE)
  const mode = result.storageMode === 'cloud' ? 'cloud' : 'local'
  console.info(`[${APP_NAME}] Current storage mode: ${mode}`)
  return mode
}

export function compileRules (rules: GeoBypassSettings['rules'] = []): RuntimeProxyRule[] {
  return (rules || []).map(rule => {
    // Compile staticExtensions RegExp
    let compiledStaticExtensions: RegExp | undefined = undefined
    const match = rule.staticExtensions?.match(/^\/(.*)\/([gimsuy]*)$/)
    if (match) {
      compiledStaticExtensions = new RegExp(match[1], match[2])
    }

    // Compile match patterns using Matcher type
    const compiledMatch = rule.match.map(p => matchPattern(p, { strict: false }).assertValid())
    const compiledBypassUrlPatterns = (rule.bypassUrlPatterns || []).map(
      p => matchPattern(p, { strict: false }).assertValid())
    const compiledForceProxyUrlPatterns = (rule.forceProxyUrlPatterns || []).map(
      p => matchPattern(p, { strict: false }).assertValid())

    return {
      ...rule,
      compiledMatch,
      compiledBypassUrlPatterns,
      compiledForceProxyUrlPatterns,
      compiledStaticExtensions,
    } as RuntimeProxyRule
  })
}

export async function getConfig (): Promise<GeoBypassRuntimeSettings> {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  const result = await storage.get(Object.values(STORAGE_KEYS)) as Record<string, unknown>
  const config: GeoBypassSettings = {
    proxyList: (result[STORAGE_KEYS.proxyList] as GeoBypassSettings['proxyList']) ?? DEFAULT_SETTINGS.proxyList,
    defaultProxy: (result[STORAGE_KEYS.defaultProxy] as GeoBypassSettings['defaultProxy']) ?? DEFAULT_SETTINGS.defaultProxy,
    fallbackDirect: (result[STORAGE_KEYS.fallbackDirect] as GeoBypassSettings['fallbackDirect']) ?? DEFAULT_SETTINGS.fallbackDirect,
    testProxyUrl: (result[STORAGE_KEYS.testProxyUrl] as GeoBypassSettings['testProxyUrl']) ?? DEFAULT_SETTINGS.testProxyUrl,
    rules: (result[STORAGE_KEYS.rules] as GeoBypassSettings['rules']) ?? DEFAULT_SETTINGS.rules,
    keepAliveRules: result[STORAGE_KEYS.keepAliveRules] as GeoBypassSettings['keepAliveRules'],
  }

  if (!result || Object.keys(result).length === 0) {
    console.warn(`[${APP_NAME}] No config found. Saving and using default settings.`)
    await saveConfig(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS as GeoBypassRuntimeSettings
  }

  config.rules = compileRules(config.rules)
  console.info(`[${APP_NAME}] Compiled ${config.rules.length} rule(s) with patterns.`)

  return config as GeoBypassRuntimeSettings
}

export async function saveConfig (config: GeoBypassSettings) {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  await storage.set({
    [STORAGE_KEYS.proxyList]: config.proxyList,
    [STORAGE_KEYS.defaultProxy]: config.defaultProxy,
    [STORAGE_KEYS.fallbackDirect]: config.fallbackDirect,
    [STORAGE_KEYS.testProxyUrl]: config.testProxyUrl,
    [STORAGE_KEYS.rules]: config.rules?.map(rule => ({
      // Only save original (non-compiled) fields
      name: rule.name,
      match: rule.match,
      siteMatch: rule.siteMatch,
      bypassUrlPatterns: rule.bypassUrlPatterns,
      bypassRequestTypes: rule.bypassRequestTypes,
      staticExtensions: rule.staticExtensions,
      forceProxyUrlPatterns: rule.forceProxyUrlPatterns,
      fallbackDirect: rule.fallbackDirect,
      proxyId: rule.proxyId,
      active: typeof rule.active !== 'undefined' ? rule.active : true,
    })),
    [STORAGE_KEYS.keepAliveRules]: config.keepAliveRules,
  })
  console.info(`[${APP_NAME}] Saved config to ${storageMode} storage.`)
}

export async function updateConfig (config: Partial<GeoBypassSettings>) {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  const update: Record<string, unknown> = {}
  if (config.proxyList !== undefined) update[STORAGE_KEYS.proxyList] = config.proxyList
  if (config.defaultProxy !== undefined) update[STORAGE_KEYS.defaultProxy] = config.defaultProxy
  if (config.fallbackDirect !== undefined) update[STORAGE_KEYS.fallbackDirect] = config.fallbackDirect
  if (config.testProxyUrl !== undefined) update[STORAGE_KEYS.testProxyUrl] = config.testProxyUrl
  if (config.rules !== undefined) update[STORAGE_KEYS.rules] = config.rules
  if (config.keepAliveRules !== undefined) update[STORAGE_KEYS.keepAliveRules] = config.keepAliveRules
  await storage.set(update)
  console.info(`[${APP_NAME}] Updated partial config in ${storageMode} storage.`)
}
