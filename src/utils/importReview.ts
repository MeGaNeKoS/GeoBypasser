import type { KeepAliveProxyRule, ProxyListItem, ProxyRule } from '@customTypes/proxy'
import type { GeoBypassSettings } from '@customTypes/settings'
import { findSettingChanges, withAppliedSettings } from '@utils/importFiles'
import type { ImportableSetting, ImportableSettings, ImportNote, SettingChange } from '@utils/importFiles'
import { duplicateKeysOf, mapAfterImport } from '@utils/mapImport'
import { storedProxyLabel } from '@utils/pageView'
import { applyImportedProxy, duplicateIndexOf } from '@utils/proxyDraft'
import type { DuplicateChoice } from '@utils/proxyDraft'

export type ReviewTargets = Pick<GeoBypassSettings, 'proxyList' | 'rules' | 'keepAliveRules' | 'perWebsiteOverride'> & ImportableSettings

export type DuplicateResolution = 'keepExisting' | 'useNew' | 'keepBoth'
export type DuplicateKind = 'proxy' | 'site' | 'keepAlive'

export interface ReviewDuplicate {
  key: string
  kind: DuplicateKind
  label: string
  allowedResolutions: DuplicateResolution[]
  resolution: DuplicateResolution
  storedIndex?: number
}

export interface AddCounts {
  proxies: number
  rules: number
  keepAliveRules: number
  siteOverrides: number
}

export interface ImportReview {
  adds: AddCounts
  notes: { refused: ImportNote[]; ignored: ImportNote[] }
  duplicates: ReviewDuplicate[]
  settingChanges: SettingChange[]
  canImport: boolean
}

export interface ImportDecisions {
  duplicates: Record<string, DuplicateResolution>
  settings: ImportableSetting[]
}

export interface AppliedImport {
  targets: ReviewTargets
  added: AddCounts
}

type IncomingTargets = Partial<ReviewTargets>

const DEFAULT_RESOLUTION: DuplicateResolution = 'keepExisting'
const PROXY_RESOLUTIONS: DuplicateResolution[] = ['keepExisting', 'useNew', 'keepBoth']
const MAP_RESOLUTIONS: DuplicateResolution[] = ['keepExisting', 'useNew']
const PROXY_CHOICES: Record<DuplicateResolution, DuplicateChoice> = {
  keepExisting: 'skip',
  useNew: 'replace',
  keepBoth: 'keepBoth',
}
const COUNT_PHRASES: [keyof AddCounts, string, string][] = [
  ['rules', 'rule', 'rules'],
  ['proxies', 'proxy', 'proxies'],
  ['keepAliveRules', 'keep-alive rule', 'keep-alive rules'],
  ['siteOverrides', 'site', 'sites'],
]
const NO_DECISIONS: ImportDecisions = { duplicates: {}, settings: [] }
const PLANNED_COPY_ID_PREFIX = 'planned-copy-'

export function reviewImport (
  stored: ReviewTargets,
  incoming: IncomingTargets,
  notes: ImportNote[],
  decisions: ImportDecisions = NO_DECISIONS,
): ImportReview {
  const proxies = incoming.proxyList ?? []
  const proxyIds = finalProxyIds(stored.proxyList, proxies, decisions, plannedCopyId)
  const remapped = remapIncoming(incoming, proxyIds)
  const rules = remapped.rules ?? []
  const keepAliveRules = remapped.keepAliveRules ?? {}
  const siteOverrides = remapped.perWebsiteOverride ?? {}
  const duplicates = [
    ...proxyDuplicates(stored.proxyList, proxies),
    ...mapDuplicates('site', stored.perWebsiteOverride, siteOverrides, stored.proxyList),
    ...mapDuplicates('keepAlive', stored.keepAliveRules ?? {}, keepAliveRules, stored.proxyList),
  ]
  const adds: AddCounts = {
    proxies: proxies.length - duplicateCount(duplicates, 'proxy'),
    rules: rules.length,
    keepAliveRules: Object.keys(keepAliveRules).length - duplicateCount(duplicates, 'keepAlive'),
    siteOverrides: Object.keys(siteOverrides).length - duplicateCount(duplicates, 'site'),
  }
  const settingChanges = findSettingChanges(stored, remapped, stored.proxyList)
  return {
    adds,
    notes: {
      refused: notes.filter(note => note.kind === 'refused'),
      ignored: notes.filter(note => note.kind === 'ignored'),
    },
    duplicates,
    settingChanges,
    canImport: totalOf(adds) + duplicates.length > 0 || settingChanges.length > 0,
  }
}

export function defaultDecisions (review: ImportReview): ImportDecisions {
  return {
    duplicates: Object.fromEntries(review.duplicates.map(duplicate => [duplicate.key, duplicate.resolution])),
    settings: [],
  }
}

export function applyImportDecisions (
  stored: ReviewTargets,
  incoming: IncomingTargets,
  review: ImportReview,
  decisions: ImportDecisions,
  newId: () => string,
): AppliedImport {
  const proxies = incoming.proxyList ?? []
  const copyIds = proxies.map(() => newId())
  const copyIdFor = (index: number) => copyIds[index]
  const proxyIds = finalProxyIds(stored.proxyList, proxies, decisions, copyIdFor)
  const remapped = remapIncoming(incoming, proxyIds)
  const storedSettings: ImportableSettings = {
    defaultProxy: stored.defaultProxy,
    fallbackDirect: stored.fallbackDirect,
    testProxyUrl: stored.testProxyUrl,
  }
  const importedSettings: ImportableSettings = { ...storedSettings, ...remapped }
  const applied = decisions.settings.filter(setting => review.settingChanges.some(change => change.setting === setting))
  return {
    targets: {
      proxyList: applyProxies(stored.proxyList, proxies, review.duplicates, decisions, copyIdFor),
      rules: [...stored.rules, ...(remapped.rules ?? [])],
      keepAliveRules: applyMap('keepAlive', stored.keepAliveRules ?? {}, remapped.keepAliveRules ?? {}, review.duplicates, decisions),
      perWebsiteOverride: applyMap('site', stored.perWebsiteOverride, remapped.perWebsiteOverride ?? {}, review.duplicates, decisions),
      ...withAppliedSettings(storedSettings, importedSettings, applied),
    },
    added: addedCounts(remapped, review.duplicates, decisions),
  }
}

export function describeAdded (counts: AddCounts): string {
  const parts = COUNT_PHRASES
    .filter(([key]) => counts[key] > 0)
    .map(([key, singular, plural]) => `${counts[key]} ${counts[key] === 1 ? singular : plural}`)
  return parts.length === 0 ? 'Nothing was imported' : `Imported ${parts.join(', ')}`
}

function plannedCopyId (index: number): string {
  return `${PLANNED_COPY_ID_PREFIX}${index}`
}

function proxyKey (index: number) {
  return `proxy:${index}`
}

function resolutionOf (decisions: ImportDecisions, key: string): DuplicateResolution {
  return decisions.duplicates[key] ?? DEFAULT_RESOLUTION
}

function finalProxyIds (
  stored: ProxyListItem[],
  incoming: ProxyListItem[],
  decisions: ImportDecisions,
  copyIdFor: (index: number) => string,
): Map<string, string> {
  return new Map(incoming.map((proxy, index) => [proxy.id, finalProxyId(stored, proxy, index, decisions, copyIdFor)]))
}

function finalProxyId (
  stored: ProxyListItem[],
  proxy: ProxyListItem,
  index: number,
  decisions: ImportDecisions,
  copyIdFor: (index: number) => string,
): string {
  const storedIndex = duplicateIndexOf(stored, proxy)
  if (storedIndex === undefined) return proxy.id
  if (resolutionOf(decisions, proxyKey(index)) === 'keepBoth') return copyIdFor(index)
  return stored[storedIndex].id
}

function remapIncoming (incoming: IncomingTargets, proxyIds: Map<string, string>): IncomingTargets {
  const remapId = (proxyId: string) => proxyIds.get(proxyId) ?? proxyId
  return {
    ...incoming,
    defaultProxy: incoming.defaultProxy === undefined ? undefined : remapId(incoming.defaultProxy),
    rules: incoming.rules?.map(rule => ({ ...rule, proxyId: remapId(rule.proxyId) })),
    perWebsiteOverride: incoming.perWebsiteOverride && mapValues(incoming.perWebsiteOverride, remapId),
    keepAliveRules: incoming.keepAliveRules && mapKeys(incoming.keepAliveRules, remapId),
  }
}

function mapValues<T, U> (record: Record<string, T>, change: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, change(value)]))
}

function mapKeys<T> (record: Record<string, T>, change: (key: string) => string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [change(key), value]))
}

function proxyDuplicates (stored: ProxyListItem[], incoming: ProxyListItem[]): ReviewDuplicate[] {
  return incoming.flatMap((proxy, index) => {
    const storedIndex = duplicateIndexOf(stored, proxy)
    if (storedIndex === undefined) return []
    return [{
      key: proxyKey(index),
      kind: 'proxy',
      label: `${proxy.host}:${proxy.port}`,
      allowedResolutions: PROXY_RESOLUTIONS,
      resolution: DEFAULT_RESOLUTION,
      storedIndex,
    }]
  })
}

function mapDuplicates (
  kind: 'site' | 'keepAlive',
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
  storedProxies: ProxyListItem[],
): ReviewDuplicate[] {
  return duplicateKeysOf(stored, incoming).map(targetKey => ({
    key: mapDuplicateKey(kind, targetKey),
    kind,
    label: kind === 'keepAlive' ? storedProxyLabel(storedProxies, targetKey) ?? targetKey : targetKey,
    allowedResolutions: MAP_RESOLUTIONS,
    resolution: DEFAULT_RESOLUTION,
  }))
}

function mapDuplicateKey (kind: 'site' | 'keepAlive', targetKey: string) {
  return `${kind}:${targetKey}`
}

function duplicateCount (duplicates: ReviewDuplicate[], kind: DuplicateKind) {
  return duplicates.filter(duplicate => duplicate.kind === kind).length
}

function totalOf (counts: AddCounts) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

function resolutionFor (duplicate: ReviewDuplicate, decisions: ImportDecisions): DuplicateResolution {
  const chosen = decisions.duplicates[duplicate.key] ?? duplicate.resolution
  if (!duplicate.allowedResolutions.includes(chosen)) {
    throw new Error(`Duplicate ${duplicate.key} does not offer ${chosen}`)
  }
  return chosen
}

function duplicateOf (duplicates: ReviewDuplicate[], key: string) {
  return duplicates.find(duplicate => duplicate.key === key)
}

function applyProxies (
  stored: ProxyListItem[],
  incoming: ProxyListItem[],
  duplicates: ReviewDuplicate[],
  decisions: ImportDecisions,
  copyIdFor: (index: number) => string,
): ProxyListItem[] {
  return incoming.reduce<ProxyListItem[]>((list, proxy, index) => {
    const duplicate = duplicateOf(duplicates, proxyKey(index))
    if (!duplicate) return applyImportedProxy(list, { proxy, copyId: copyIdFor(index) })
    const choice = PROXY_CHOICES[resolutionFor(duplicate, decisions)]
    return applyImportedProxy(list, { proxy, duplicateIndex: duplicate.storedIndex, choice, copyId: copyIdFor(index) })
  }, stored)
}

function applyMap<T>(
  kind: 'site' | 'keepAlive',
  stored: Record<string, T>,
  incoming: Record<string, T>,
  duplicates: ReviewDuplicate[],
  decisions: ImportDecisions,
): Record<string, T> {
  const replacedKeys = Object.keys(incoming).filter(key => {
    const duplicate = duplicateOf(duplicates, mapDuplicateKey(kind, key))
    return duplicate !== undefined && resolutionFor(duplicate, decisions) === 'useNew'
  })
  return mapAfterImport(stored, incoming, replacedKeys)
}

function skippedCount (kind: DuplicateKind, duplicates: ReviewDuplicate[], decisions: ImportDecisions) {
  return duplicates.filter(duplicate => duplicate.kind === kind && resolutionFor(duplicate, decisions) === 'keepExisting').length
}

function addedCounts (incoming: IncomingTargets, duplicates: ReviewDuplicate[], decisions: ImportDecisions): AddCounts {
  return {
    proxies: (incoming.proxyList?.length ?? 0) - skippedCount('proxy', duplicates, decisions),
    rules: incoming.rules?.length ?? 0,
    keepAliveRules: Object.keys(incoming.keepAliveRules ?? {}).length - skippedCount('keepAlive', duplicates, decisions),
    siteOverrides: Object.keys(incoming.perWebsiteOverride ?? {}).length - skippedCount('site', duplicates, decisions),
  }
}
