import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import browser from 'webextension-polyfill'
import type { ProxyId, StorageMode } from '@customTypes/generic'
import { APP_NAME, DEFAULT_SETTINGS } from '@constant/defaults'
import { STORAGE_KEYS, STORAGE_MODE, TAB_PROXY_MAP } from '@constant/storageKeys'

import type { RuntimeProxyRule } from '@customTypes/proxy'
import { matchPattern } from 'browser-extension-url-match'
import { MatchPatternOptions } from 'browser-extension-url-match/dist/types'
import { compileStaticExtensions, isValidOverrideEntry, isValidRule, isValidTestUrl } from '@utils/validity'

function isValidTabProxyMap (obj: unknown): obj is Record<number, ProxyId> {
  if (typeof obj !== 'object' || obj === null) return false
  return Object.entries(obj).every(([key, value]) =>
    !isNaN(Number(key)) && typeof value === 'string',
  )
}

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeCompile (pattern: string[] | string, options?: Partial<MatchPatternOptions>) {
  try {
    return matchPattern(pattern, options).assertValid()
  } catch (err) {
    console.error(`Invalid pattern "${pattern}":`, err)
    return
  }
}

const storedSnapshot = new Map<string, string | undefined>()

export async function getUserStorageMode (): Promise<StorageMode> {
  const result = await browser.storage.local.get(STORAGE_MODE)
  const mode = result.storageMode === 'cloud' ? 'cloud' : 'local'
  console.info(`[${APP_NAME}] Current storage mode: ${mode}`)
  return mode
}

export function compileRules (rules: unknown[] = []): RuntimeProxyRule[] {
  return rules.map(rule => {
    if (!isValidRule(rule)) return rule as RuntimeProxyRule
    return {
      ...rule,
      compiledMatch: safeCompile(rule.match, { strict: false }),
      compiledBypassUrlPatterns: safeCompile(rule.bypassUrlPatterns || [], { strict: false }),
      compiledForceProxyUrlPatterns: safeCompile(rule.forceProxyUrlPatterns || [], { strict: false }),
      compiledStaticExtensions: compileStaticExtensions(rule.staticExtensions),
    } as RuntimeProxyRule
  })
}

export function sanitizeSection (key: string, value: unknown): any {
  switch (key) {
    case STORAGE_KEYS.proxyList:
      return Array.isArray(value) ? value : []
    case STORAGE_KEYS.defaultProxy:
      return typeof value === 'string' ? value : undefined
    case STORAGE_KEYS.fallbackDirect:
      return typeof value === 'boolean' ? value : DEFAULT_SETTINGS.fallbackDirect
    case STORAGE_KEYS.testProxyUrl:
      return isValidTestUrl(value) ? value : DEFAULT_SETTINGS.testProxyUrl
    case STORAGE_KEYS.rules:
      return compileRules(Array.isArray(value) ? value : [])
    case STORAGE_KEYS.keepAliveRules:
      return isPlainObject(value) ? value : undefined
    case STORAGE_KEYS.perWebsiteOverride:
      if (!isPlainObject(value)) return {}
      warnInvalidOverrides(value)
      return value
    default:
      return value
  }
}

function warnInvalidOverrides (overrides: Record<string, unknown>) {
  for (const [domain, proxyId] of Object.entries(overrides)) {
    if (!isValidOverrideEntry(domain, proxyId)) {
      console.warn(`[${APP_NAME}] Website override "${domain}" is not valid and is ignored.`)
    }
  }
}

const COMPILED_RULE_FIELDS = ['compiledMatch', 'compiledBypassUrlPatterns', 'compiledForceProxyUrlPatterns', 'compiledStaticExtensions']

function omitCompiledFields (rule: unknown): unknown {
  if (!isPlainObject(rule)) return rule
  const plain: Record<string, unknown> = { ...rule }
  for (const field of COMPILED_RULE_FIELDS) delete plain[field]
  return plain
}

function toStoredRules (rules: unknown): unknown {
  return Array.isArray(rules) ? rules.map(omitCompiledFields) : rules
}

function sections (config: GeoBypassSettings): Record<string, unknown> {
  return {
    [STORAGE_KEYS.proxyList]: config.proxyList,
    [STORAGE_KEYS.defaultProxy]: config.defaultProxy,
    [STORAGE_KEYS.fallbackDirect]: config.fallbackDirect,
    [STORAGE_KEYS.testProxyUrl]: config.testProxyUrl,
    [STORAGE_KEYS.rules]: toStoredRules(config.rules),
    [STORAGE_KEYS.keepAliveRules]: config.keepAliveRules,
    [STORAGE_KEYS.perWebsiteOverride]: config.perWebsiteOverride,
  }
}

export class StorageWriteError extends Error {}

async function writeSections (values: Record<string, unknown>, onlyChanged: boolean) {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  const update: Record<string, unknown> = {}
  const serializedUpdate = new Map<string, string>()
  for (const [key, value] of Object.entries(values)) {
    const serialized = JSON.stringify(value)
    if (onlyChanged && storedSnapshot.get(key) === serialized) continue
    update[key] = value
    serializedUpdate.set(key, serialized)
  }
  if (serializedUpdate.size === 0) return
  try {
    await storage.set(update)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new StorageWriteError(`Your last change was not saved to ${storageMode} storage: ${detail}`)
  }
  for (const [key, serialized] of serializedUpdate) storedSnapshot.set(key, serialized)
  console.info(`[${APP_NAME}] Saved config to ${storageMode} storage.`)
}

export async function getConfig (): Promise<GeoBypassRuntimeSettings> {
  const storageMode = await getUserStorageMode()
  const storage = storageMode === 'cloud' ? browser.storage.sync : browser.storage.local
  const result = await storage.get(Object.values(STORAGE_KEYS)) as Record<string, unknown>
  if (!result || Object.keys(result).length === 0) {
    console.warn(`[${APP_NAME}] No config found. Using default settings.`)
  }

  const config: GeoBypassRuntimeSettings = {
    proxyList: sanitizeSection(STORAGE_KEYS.proxyList, result[STORAGE_KEYS.proxyList]),
    defaultProxy: sanitizeSection(STORAGE_KEYS.defaultProxy, result[STORAGE_KEYS.defaultProxy]),
    fallbackDirect: sanitizeSection(STORAGE_KEYS.fallbackDirect, result[STORAGE_KEYS.fallbackDirect]),
    testProxyUrl: sanitizeSection(STORAGE_KEYS.testProxyUrl, result[STORAGE_KEYS.testProxyUrl]),
    rules: sanitizeSection(STORAGE_KEYS.rules, result[STORAGE_KEYS.rules]),
    keepAliveRules: sanitizeSection(STORAGE_KEYS.keepAliveRules, result[STORAGE_KEYS.keepAliveRules]),
    perWebsiteOverride: sanitizeSection(STORAGE_KEYS.perWebsiteOverride, result[STORAGE_KEYS.perWebsiteOverride]),
  }

  storedSnapshot.clear()
  for (const [key, value] of Object.entries(sections(config))) {
    storedSnapshot.set(key, JSON.stringify(value))
  }
  console.info(`[${APP_NAME}] Compiled ${config.rules.length} rule(s) with patterns.`)

  return config
}

export async function saveConfig (config: GeoBypassSettings) {
  await writeSections(sections(config), true)
}

export async function updateConfig (config: Partial<GeoBypassSettings>) {
  const update: Record<string, unknown> = {}
  if ('proxyList' in config) update[STORAGE_KEYS.proxyList] = config.proxyList
  if ('defaultProxy' in config) update[STORAGE_KEYS.defaultProxy] = config.defaultProxy
  if ('fallbackDirect' in config) update[STORAGE_KEYS.fallbackDirect] = config.fallbackDirect
  if ('testProxyUrl' in config) update[STORAGE_KEYS.testProxyUrl] = config.testProxyUrl
  if ('rules' in config) update[STORAGE_KEYS.rules] = toStoredRules(config.rules)
  if ('keepAliveRules' in config) update[STORAGE_KEYS.keepAliveRules] = config.keepAliveRules
  if ('perWebsiteOverride' in config) update[STORAGE_KEYS.perWebsiteOverride] = config.perWebsiteOverride
  await writeSections(update, false)
}

export async function getTabProxyMap (): Promise<Record<number, ProxyId>> {
  try {
    const result = await browser.storage.local.get(TAB_PROXY_MAP)
    const raw = result[TAB_PROXY_MAP]
    if (isValidTabProxyMap(raw)) {
      return raw
    }

    await browser.storage.local.remove(TAB_PROXY_MAP)
    console.warn(`[${APP_NAME}] Invalid tabProxyMap data found and removed.`)
    return {}
  } catch (error) {
    console.error(`[${APP_NAME}] Failed to get tabProxyMap:`, error)
    return {}
  }
}

export async function saveTabProxyMap (map: Record<number, ProxyId>) {
  await browser.storage.local.set({ [TAB_PROXY_MAP]: map })
  console.info(`[${APP_NAME}] Saved tabProxyMap to local storage.`)
}
