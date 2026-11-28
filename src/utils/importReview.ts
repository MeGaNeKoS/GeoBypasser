import type { ProxyListItem } from '@customTypes/proxy'
import type { GeoBypassSettings } from '@customTypes/settings'
import { findSettingChanges, withAppliedSettings } from '@utils/importFiles'
import type { ImportableSetting, ImportableSettings, ImportNote, SettingChange } from '@utils/importFiles'
import { duplicateKeysOf, mapAfterImport } from '@utils/mapImport'
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

export function reviewImport (stored: ReviewTargets, incoming: Partial<ReviewTargets>, notes: ImportNote[]): ImportReview {
  const proxies = incoming.proxyList ?? []
  const rules = incoming.rules ?? []
  const keepAliveRules = incoming.keepAliveRules ?? {}
  const siteOverrides = incoming.perWebsiteOverride ?? {}
  const duplicates = [
    ...proxyDuplicates(stored.proxyList, proxies),
    ...mapDuplicates('site', stored.perWebsiteOverride, siteOverrides),
    ...mapDuplicates('keepAlive', stored.keepAliveRules ?? {}, keepAliveRules),
  ]
  const adds: AddCounts = {
    proxies: proxies.length - duplicateCount(duplicates, 'proxy'),
    rules: rules.length,
    keepAliveRules: Object.keys(keepAliveRules).length - duplicateCount(duplicates, 'keepAlive'),
    siteOverrides: Object.keys(siteOverrides).length - duplicateCount(duplicates, 'site'),
  }
  const settingChanges = findSettingChanges(stored, incoming, stored.proxyList)
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
  incoming: Partial<ReviewTargets>,
  review: ImportReview,
  decisions: ImportDecisions,
  newId: () => string,
): AppliedImport {
  const storedSettings: ImportableSettings = {
    defaultProxy: stored.defaultProxy,
    fallbackDirect: stored.fallbackDirect,
    testProxyUrl: stored.testProxyUrl,
  }
  const importedSettings: ImportableSettings = { ...storedSettings, ...incoming }
  const applied = decisions.settings.filter(setting => review.settingChanges.some(change => change.setting === setting))
  return {
    targets: {
      proxyList: applyProxies(stored.proxyList, incoming.proxyList ?? [], review.duplicates, decisions, newId),
      rules: [...stored.rules, ...(incoming.rules ?? [])],
      keepAliveRules: applyMap('keepAlive', stored.keepAliveRules ?? {}, incoming.keepAliveRules ?? {}, review.duplicates, decisions),
      perWebsiteOverride: applyMap('site', stored.perWebsiteOverride, incoming.perWebsiteOverride ?? {}, review.duplicates, decisions),
      ...withAppliedSettings(storedSettings, importedSettings, applied),
    },
    added: addedCounts(incoming, review.duplicates, decisions),
  }
}

export function describeAdded (counts: AddCounts): string {
  const parts = COUNT_PHRASES
    .filter(([key]) => counts[key] > 0)
    .map(([key, singular, plural]) => `${counts[key]} ${counts[key] === 1 ? singular : plural}`)
  return parts.length === 0 ? 'Nothing was imported' : `Imported ${parts.join(', ')}`
}

function proxyKey (index: number) {
  return `proxy:${index}`
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

function mapDuplicates (kind: 'site' | 'keepAlive', stored: Record<string, unknown>, incoming: Record<string, unknown>): ReviewDuplicate[] {
  return duplicateKeysOf(stored, incoming).map(domainOrProxy => ({
    key: `${kind}:${domainOrProxy}`,
    kind,
    label: domainOrProxy,
    allowedResolutions: MAP_RESOLUTIONS,
    resolution: DEFAULT_RESOLUTION,
  }))
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
  newId: () => string,
): ProxyListItem[] {
  return incoming.reduce<ProxyListItem[]>((list, proxy, index) => {
    const duplicate = duplicateOf(duplicates, proxyKey(index))
    if (!duplicate) return applyImportedProxy(list, { proxy, copyId: newId() })
    const choice = PROXY_CHOICES[resolutionFor(duplicate, decisions)]
    return applyImportedProxy(list, { proxy, duplicateIndex: duplicate.storedIndex, choice, copyId: newId() })
  }, stored)
}

function applyMap<T>(
  kind: 'site' | 'keepAlive',
  stored: Record<string, T>,
  incoming: Record<string, T>,
  duplicates: ReviewDuplicate[],
  decisions: ImportDecisions,
): Record<string, T> {
  const replacedKeys = duplicates
    .filter(duplicate => duplicate.kind === kind && resolutionFor(duplicate, decisions) === 'useNew')
    .map(duplicate => duplicate.label)
  return mapAfterImport(stored, incoming, replacedKeys)
}

function skippedCount (kind: DuplicateKind, duplicates: ReviewDuplicate[], decisions: ImportDecisions) {
  return duplicates.filter(duplicate => duplicate.kind === kind && resolutionFor(duplicate, decisions) === 'keepExisting').length
}

function addedCounts (incoming: Partial<ReviewTargets>, duplicates: ReviewDuplicate[], decisions: ImportDecisions): AddCounts {
  return {
    proxies: (incoming.proxyList?.length ?? 0) - skippedCount('proxy', duplicates, decisions),
    rules: incoming.rules?.length ?? 0,
    keepAliveRules: Object.keys(incoming.keepAliveRules ?? {}).length - skippedCount('keepAlive', duplicates, decisions),
    siteOverrides: Object.keys(incoming.perWebsiteOverride ?? {}).length - skippedCount('site', duplicates, decisions),
  }
}
