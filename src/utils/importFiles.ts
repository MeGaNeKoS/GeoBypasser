import type { KeepAliveProxyRule, ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassRuntimeSettings, GeoBypassSettings } from '@customTypes/settings'
import { compileRules } from '@utils/storage'
import {
  isValidKeepAliveRule,
  isValidOverrideEntry,
  isValidPattern,
  isValidProxyHost,
  isValidProxyId,
  isValidProxyItem,
  isValidProxyPort,
  isValidProxyType,
  isValidResourceTypes,
  isValidRule,
  isValidStaticExtensions,
  isValidTestUrl,
} from '@utils/validity'

export interface ImportResult<T> {
  accepted: T
  messages: string[]
}

const PATTERN_FIELDS = ['match', 'bypassUrlPatterns', 'forceProxyUrlPatterns'] as const

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function notImported (section: string, shape: string) {
  return `${section} was not imported: the file does not hold ${shape}.`
}

function positionName (index: number) {
  return `entry ${index + 1}`
}

function nonEmptyText (value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function entryName (entry: unknown, index: number) {
  return (isPlainObject(entry) && nonEmptyText(entry.name)) || positionName(index)
}

function proxyName (entry: unknown, index: number) {
  return (isPlainObject(entry) && nonEmptyText(entry.label)) || positionName(index)
}

function proxyProblem (entry: unknown) {
  if (!isPlainObject(entry)) return 'it is not an object'
  if (!isValidProxyId(entry.id)) return 'it has no id'
  if (!isValidProxyType(entry.type)) return 'its type is not socks or http'
  if (!isValidProxyHost(entry.host)) return 'its host is empty or contains a character that is not allowed'
  if (!isValidProxyPort(entry.port)) return 'its port must be a whole number from 1 to 65535'
  return 'a field is missing or has the wrong type'
}

function invalidPatternProblem (rule: Record<string, unknown>) {
  for (const field of PATTERN_FIELDS) {
    const list = rule[field]
    if (!Array.isArray(list)) continue
    const index = list.findIndex(pattern => !isValidPattern(pattern))
    if (index >= 0) return `${field} pattern "${String(list[index])}" is not valid`
  }
  return undefined
}

function ruleProblem (entry: unknown) {
  if (!isPlainObject(entry)) return 'it is not an object'
  if (typeof entry.name !== 'string' || entry.name.trim() === '') return 'it has no name'
  if (!Array.isArray(entry.match) || entry.match.length === 0) return 'it has no match pattern'
  if (typeof entry.proxyId !== 'string' || entry.proxyId === '') return 'it has no proxy'
  if (!isValidResourceTypes(entry.bypassResourceTypes)) return 'its bypass resource types are not known names'
  return invalidPatternProblem(entry) ?? 'a field is missing or has the wrong type'
}

export function refuseProxyItems (list: unknown): ImportResult<ProxyListItem[]> {
  if (!Array.isArray(list)) return { accepted: [], messages: [notImported('Proxy list', 'a list of proxies')] }
  const accepted: ProxyListItem[] = []
  const messages: string[] = []
  list.forEach((entry, index) => {
    if (isValidProxyItem(entry)) {
      accepted.push(entry)
      return
    }
    messages.push(`Proxy "${proxyName(entry, index)}" was not imported: ${proxyProblem(entry)}.`)
  })
  return { accepted, messages }
}

export function refuseRules (list: unknown): ImportResult<ProxyRule[]> {
  if (!Array.isArray(list)) return { accepted: [], messages: [notImported('Rule list', 'a list of rules')] }
  const accepted: ProxyRule[] = []
  const messages: string[] = []
  list.forEach((entry, index) => {
    const name = entryName(entry, index)
    if (!isValidRule(entry)) {
      messages.push(`Rule "${name}" was not imported: ${ruleProblem(entry)}.`)
      return
    }
    accepted.push(entry)
    if (!isValidStaticExtensions(entry.staticExtensions)) {
      messages.push(`Rule "${name}" has a staticExtensions value that is not valid, so that setting is ignored.`)
    }
  })
  return { accepted, messages }
}

export function refuseOverrides (map: unknown): ImportResult<Record<string, string>> {
  if (!isPlainObject(map)) return { accepted: {}, messages: [notImported('Website overrides', 'an object of domains')] }
  const accepted: Record<string, string> = {}
  const messages: string[] = []
  for (const [domain, proxyId] of Object.entries(map)) {
    if (isValidOverrideEntry(domain, proxyId)) {
      accepted[domain] = proxyId as string
    } else {
      messages.push(`Website override "${domain}" was not imported: its domain or proxy is not valid.`)
    }
  }
  return { accepted, messages }
}

export function refuseKeepAliveRules (map: unknown): ImportResult<KeepAliveProxyRule> {
  if (!isPlainObject(map)) return { accepted: {}, messages: [notImported('Keep-alive rules', 'an object of proxies')] }
  const accepted: KeepAliveProxyRule = {}
  const messages: string[] = []
  for (const [proxyId, rule] of Object.entries(map)) {
    if (!isValidKeepAliveRule(rule)) {
      messages.push(`Keep-alive rule for proxy "${proxyId}" was not imported: its active flag or tab URL patterns are not valid.`)
      continue
    }
    const keepAlive = rule as KeepAliveProxyRule[string]
    accepted[proxyId] = keepAlive
    if (keepAlive.testProxyUrl !== undefined && !isValidTestUrl(keepAlive.testProxyUrl)) {
      messages.push(`Keep-alive rule for proxy "${proxyId}" has a test URL that is not valid, so that test URL is ignored.`)
    }
  }
  return { accepted, messages }
}

export function refuseConfigFile (obj: unknown): ImportResult<Partial<GeoBypassSettings>> {
  if (!isPlainObject(obj)) {
    return { accepted: {}, messages: [notImported('Config file', 'a settings object')] }
  }
  const accepted: Partial<GeoBypassSettings> = {}
  const messages: string[] = []

  if ('proxyList' in obj) {
    const part = refuseProxyItems(obj.proxyList)
    accepted.proxyList = part.accepted
    messages.push(...part.messages)
  }
  if ('rules' in obj) {
    const part = refuseRules(obj.rules)
    accepted.rules = part.accepted
    messages.push(...part.messages)
  }
  if ('keepAliveRules' in obj) {
    const part = refuseKeepAliveRules(obj.keepAliveRules)
    accepted.keepAliveRules = part.accepted
    messages.push(...part.messages)
  }
  if ('perWebsiteOverride' in obj) {
    const part = refuseOverrides(obj.perWebsiteOverride)
    accepted.perWebsiteOverride = part.accepted
    messages.push(...part.messages)
  }
  if ('defaultProxy' in obj) {
    if (typeof obj.defaultProxy === 'string') accepted.defaultProxy = obj.defaultProxy
    else messages.push('Default proxy was not imported: it is not a proxy id.')
  }
  if ('fallbackDirect' in obj) {
    if (typeof obj.fallbackDirect === 'boolean') accepted.fallbackDirect = obj.fallbackDirect
    else messages.push('Fallback setting was not imported: it is not true or false.')
  }
  if ('testProxyUrl' in obj) {
    if (isValidTestUrl(obj.testProxyUrl)) accepted.testProxyUrl = obj.testProxyUrl
    else messages.push(`Test URL "${String(obj.testProxyUrl)}" was not imported: it is not an http or https URL.`)
  }

  return { accepted, messages }
}

export type ImportableSetting = 'defaultProxy' | 'fallbackDirect' | 'testProxyUrl'
export type ImportableSettings = Pick<GeoBypassSettings, ImportableSetting>

export interface SettingChange {
  setting: ImportableSetting
  title: string
  oldText: string
  newText: string
}

const IMPORTABLE_SETTINGS: readonly ImportableSetting[] = ['defaultProxy', 'fallbackDirect', 'testProxyUrl']

const SETTING_TITLES: Record<ImportableSetting, string> = {
  defaultProxy: 'Default proxy',
  fallbackDirect: 'Connect directly when a proxy fails',
  testProxyUrl: 'Test URL',
}

function describeProxy (proxyId: unknown, proxies: ProxyListItem[]): string {
  if (typeof proxyId !== 'string' || proxyId === '') return 'None'
  const proxy = proxies.find(p => isValidProxyItem(p) && p.id === proxyId)
  return proxy ? (proxy.label || proxy.host) : `${proxyId} (not in your list)`
}

function describeSetting (setting: ImportableSetting, value: unknown, proxies: ProxyListItem[]): string {
  if (setting === 'defaultProxy') return describeProxy(value, proxies)
  if (setting === 'fallbackDirect') return value ? 'On' : 'Off'
  return typeof value === 'string' && value !== '' ? value : 'None'
}

function settingChangeFor (
  setting: ImportableSetting,
  stored: Partial<ImportableSettings>,
  imported: Partial<ImportableSettings>,
  proxies: ProxyListItem[],
): SettingChange[] {
  const next = imported[setting]
  if (next === undefined || next === stored[setting]) return []
  return [{
    setting,
    title: SETTING_TITLES[setting],
    oldText: describeSetting(setting, stored[setting], proxies),
    newText: describeSetting(setting, next, proxies),
  }]
}

export function findSettingChanges (
  stored: Partial<ImportableSettings>,
  imported: Partial<ImportableSettings>,
  proxies: ProxyListItem[],
): SettingChange[] {
  return IMPORTABLE_SETTINGS.flatMap(setting => settingChangeFor(setting, stored, imported, proxies))
}

export function withAppliedSettings (
  stored: ImportableSettings,
  imported: ImportableSettings,
  applied: readonly ImportableSetting[],
): ImportableSettings {
  const choose = <S extends ImportableSetting>(setting: S): ImportableSettings[S] =>
    applied.includes(setting) ? imported[setting] : stored[setting]
  return {
    defaultProxy: choose('defaultProxy'),
    fallbackDirect: choose('fallbackDirect'),
    testProxyUrl: choose('testProxyUrl'),
  }
}

export function withImportedRules (settings: GeoBypassRuntimeSettings, rules: ProxyRule[]): GeoBypassRuntimeSettings {
  return { ...settings, rules: [...settings.rules, ...compileRules(rules)] }
}
