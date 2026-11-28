import type { KeepAliveProxyRule, ProxyListItem } from '@customTypes/proxy'
import type { GeoBypassSettings } from '@customTypes/settings'
import { exportProxyList, type CredentialsOption } from '@utils/proxyCredentials'
import { exportedRules } from '@utils/ruleExport'

export interface ConfigExportSelection {
  proxyIndexes: number[];
  ruleIndexes: number[];
  overrideDomains: string[];
  keepAliveIds: string[];
}

export type ConfigExportSource = Pick<GeoBypassSettings, 'proxyList' | 'perWebsiteOverride' | 'keepAliveRules'> & {
  rules: unknown[];
}

type ExportedConfig = Partial<Omit<GeoBypassSettings, 'rules'>> & { rules?: Record<string, unknown>[] }

export function buildProxiesExport (proxies: ProxyListItem[]) {
  return { proxyList: proxies }
}

export function buildSitesExport (perWebsiteOverride: Record<string, string>) {
  return { perWebsiteOverride }
}

export function buildKeepAliveExport (keepAliveRules: KeepAliveProxyRule) {
  return { keepAliveRules }
}

export function buildConfigExport (
  source: ConfigExportSource,
  selection: ConfigExportSelection,
  credentials: CredentialsOption,
): ExportedConfig {
  const exported: ExportedConfig = {}
  if (selection.proxyIndexes.length) {
    exported.proxyList = exportProxyList(selection.proxyIndexes.map(index => source.proxyList[index]), credentials)
  }
  const exportedProxyIds = new Set(exported.proxyList?.map(proxy => proxy?.id))
  if (selection.ruleIndexes.length) {
    exported.rules = exportedRules(
      selection.ruleIndexes.map(index => source.rules[index]),
      proxyId => typeof proxyId === 'string' && exportedProxyIds.has(proxyId),
    )
  }
  if (selection.overrideDomains.length) {
    exported.perWebsiteOverride = pickKeys(source.perWebsiteOverride, selection.overrideDomains)
  }
  if (selection.keepAliveIds.length) {
    exported.keepAliveRules = pickKeys(source.keepAliveRules, selection.keepAliveIds)
  }
  return exported
}

export interface ConfigExportChoices {
  proxies: string[];
  rules: string[];
  overrides: string[];
  keepAlive: string[];
}

export function buildConfigExportFromChoices (
  source: ConfigExportSource,
  choices: ConfigExportChoices,
  credentials: CredentialsOption,
): ExportedConfig {
  return buildConfigExport(source, {
    proxyIndexes: choices.proxies.map(Number),
    ruleIndexes: choices.rules.map(Number),
    overrideDomains: choices.overrides,
    keepAliveIds: choices.keepAlive,
  }, credentials)
}

function pickKeys<T> (record: Record<string, T> | undefined, keys: string[]): Record<string, T> {
  return Object.fromEntries(keys.flatMap(key => record?.[key] === undefined ? [] : [[key, record[key]] as const]))
}
