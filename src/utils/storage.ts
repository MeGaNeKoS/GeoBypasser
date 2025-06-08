import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import browser from 'webextension-polyfill'
import type { storageMode } from '@customTypes/generic'
import { APP_NAME, DEFAULT_SETTINGS } from '@constant/defaults'
import { STORAGE_KEY, STORAGE_MODE } from '@constant/storageKeys'

import type { RuntimeProxyRule } from '@customTypes/proxy'
import { matchPattern } from 'browser-extension-url-match'

export async function getUserStorageMode (): Promise<storageMode> {
  const result = await browser.storage.local.get(STORAGE_MODE)
  const mode = result.storageMode === 'cloud' ? 'cloud' : 'local'
  console.info(`[${APP_NAME}] Current storage mode: ${mode}`)
  return mode
}

export async function getConfig (): Promise<GeoBypassRuntimeSettings> {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  const result = await storage.get(STORAGE_KEY)
  const config = result[STORAGE_KEY] as GeoBypassSettings

  if (!config) {
    console.warn(`[${APP_NAME}] No config found. Saving and using default settings.`)
    await saveConfig(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS as GeoBypassRuntimeSettings
  }

  if (config?.rules && Array.isArray(config.rules)) {
    config.rules = config.rules.map(rule => {
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
    console.info(`[${APP_NAME}] Compiled ${config.rules.length} rule(s) with patterns.`)
  }

  return config as GeoBypassRuntimeSettings
}

export async function saveConfig (config: GeoBypassSettings) {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  const configToSave = {
    ...config,
    rules: config.rules?.map(rule => ({
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
  }

  await storage.set({ [STORAGE_KEY]: configToSave })
  console.info(`[${APP_NAME}] Saved config to ${storageMode} storage.`)
}
