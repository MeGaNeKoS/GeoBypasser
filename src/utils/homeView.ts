import type { ProxyListItem } from '@customTypes/proxy'
import type { ProxyControlState } from '@customTypes/proxyControl'
import { setAsideCounts } from '@utils/pageView'
import { isProxyNotInEffect } from '@utils/proxyControl'
import type { SetAsideCounts, SetAsideSource } from '@utils/pageView'
import { isRuleActive, usableKeepAliveRules, usableOverrides, usableProxies, usableRules } from '@utils/usable'

export type HomeCase = 'firstTime' | 'partWay' | 'setUp'
export type HomeBrowser = 'firefox' | 'chrome'
export type HomeBadge = 'firefox' | 'limited' | 'unavailable'

export type HomeSettings = SetAsideSource & {
  defaultProxy?: unknown
  fallbackDirect?: unknown
}

export type HomeInput = {
  settings: HomeSettings
  tabProxyMap: Record<number, unknown>
  browser: HomeBrowser
  control?: ProxyControlState
}

export type HomeStatus = {
  tone: 'ok' | 'info'
  sentence: string
}

export type SetAsideLink = {
  label: string
  section?: string
}

export type SetAsideSummary = {
  total: number
  sentence: string
  links: SetAsideLink[]
}

export type RouteRow = {
  label: string
  section?: string
  value?: string
  note?: string
  fixNote?: string
  badge?: HomeBadge
}

export type ProxiesSummary = {
  count: number
  fixNote?: string
  keepAliveRules: number
  keepAliveBadge?: HomeBadge
  notifyIfDown: number
}

export type GetStartedState = {
  proxyAdded: boolean
  choiceMade: boolean
}

export type HomeView = {
  case: HomeCase
  status: HomeStatus | null
  setAside: SetAsideSummary
  routes: RouteRow[]
  failureNote: string
  proxies: ProxiesSummary
  getStarted: GetStartedState
  sitesShown: boolean
}

type HomeFacts = {
  proxies: ProxyListItem[]
  activeRules: number
  routingRules: number
  offRules: number
  sites: number
  routingSites: number
  keepAliveRules: number
  notifyIfDown: number
  tabsWithProxy: number
  defaultProxy?: ProxyListItem
  defaultProxyStored: boolean
  setAside: SetAsideCounts
  notInEffect: boolean
}

const NOT_IN_EFFECT_SENTENCE = 'Your settings are saved but not in effect.'
const NOTHING_ROUTED_SENTENCE = 'Nothing is routed yet. Add a proxy for your rules to use.'
const SITES_SECTION = 'sites'
const CONNECTS_DIRECTLY_NOTE = 'If a proxy fails: connect directly'
const REQUEST_FAILS_NOTE = 'If a proxy fails: the request fails'

const SET_ASIDE_KINDS: readonly {
  countOf: (counts: SetAsideCounts) => number
  singular: string
  plural: string
  section: string
}[] = [
  { countOf: counts => counts.proxies, singular: 'proxy', plural: 'proxies', section: 'proxies' },
  { countOf: counts => counts.rules, singular: 'rule', plural: 'rules', section: 'rules' },
  { countOf: counts => counts.sites, singular: 'site', plural: 'sites', section: 'sites' },
  { countOf: counts => counts.keepAlive, singular: 'keep-alive rule', plural: 'keep-alive rules', section: 'keep-alive' },
]

export function homeViewFor (input: HomeInput): HomeView {
  const facts = homeFacts(input)
  const homeCase = caseFor(facts)
  return {
    case: homeCase,
    status: statusFor(homeCase, facts),
    setAside: setAsideSummary(facts.setAside),
    routes: routeRows(facts, input.browser),
    failureNote: input.settings.fallbackDirect === false ? REQUEST_FAILS_NOTE : CONNECTS_DIRECTLY_NOTE,
    proxies: proxiesSummary(facts, input.browser),
    getStarted: {
      proxyAdded: facts.proxies.length > 0,
      choiceMade: isUsedByRouting(facts),
    },
    sitesShown: input.browser === 'firefox',
  }
}

function homeFacts (input: HomeInput): HomeFacts {
  const { settings } = input
  const proxies = usableProxies(settings.proxyList)
  const rules = usableRules(settings.rules)
  const overrides = usableOverrides(settings.perWebsiteOverride)
  const defaultProxy = proxies.find(proxy => proxy.id === settings.defaultProxy)
  const canRoute = (proxyId: unknown): boolean => proxies.some(proxy => proxy.id === proxyId) || defaultProxy !== undefined
  return {
    proxies,
    activeRules: rules.filter(isRuleActive).length,
    routingRules: rules.filter(rule => isRuleActive(rule) && canRoute(rule.proxyId)).length,
    offRules: rules.filter(rule => !isRuleActive(rule)).length,
    sites: Object.keys(overrides).length,
    routingSites: Object.values(overrides).filter(canRoute).length,
    keepAliveRules: Object.keys(usableKeepAliveRules(settings.keepAliveRules)).length,
    notifyIfDown: proxies.filter(proxy => proxy.notifyIfDown).length,
    tabsWithProxy: countTabsWithProxy(input.tabProxyMap, proxies),
    defaultProxy,
    defaultProxyStored: Boolean(settings.defaultProxy),
    setAside: setAsideCounts(settings),
    notInEffect: input.browser === 'chrome' && isProxyNotInEffect(input.control),
  }
}

function countTabsWithProxy (tabProxyMap: Record<number, unknown>, proxies: ProxyListItem[]): number {
  const usableIds = new Set<unknown>(proxies.map(proxy => proxy.id))
  return Object.values(tabProxyMap).filter(proxyId => usableIds.has(proxyId)).length
}

function caseFor (facts: HomeFacts): HomeCase {
  if (isNothingStored(facts)) return 'firstTime'
  if (facts.proxies.length > 0 && isUsedByRouting(facts)) return 'setUp'
  return 'partWay'
}

function isNothingStored (facts: HomeFacts): boolean {
  const storedEntries = facts.proxies.length + facts.activeRules + facts.offRules + facts.sites +
    facts.setAside.proxies + facts.setAside.rules + facts.setAside.sites
  return storedEntries === 0 && !facts.defaultProxyStored
}

function isUsedByRouting (facts: HomeFacts): boolean {
  return facts.routingRules > 0 || facts.routingSites > 0 || facts.defaultProxy !== undefined
}

function statusFor (homeCase: HomeCase, facts: HomeFacts): HomeStatus | null {
  if (homeCase === 'firstTime') return null
  return {
    tone: homeCase === 'setUp' && !facts.notInEffect ? 'ok' : 'info',
    sentence: statusSentence(homeCase, facts),
  }
}

function statusSentence (homeCase: HomeCase, facts: HomeFacts): string {
  if (facts.notInEffect) return NOT_IN_EFFECT_SENTENCE
  if (homeCase === 'setUp') return routingSentence(facts)
  if (facts.proxies.length > 0) {
    return `You have ${countPhrase(facts.proxies.length, 'proxy', 'proxies')}, but nothing uses them yet.`
  }
  return NOTHING_ROUTED_SENTENCE
}

function routingSentence (facts: HomeFacts): string {
  const used = [
    facts.routingRules > 0 ? countPhrase(facts.routingRules, 'active rule', 'active rules') : null,
    facts.routingSites > 0 ? countPhrase(facts.routingSites, 'site', 'sites') : null,
    facts.defaultProxy ? `default proxy ${proxyLabel(facts.defaultProxy)}` : null,
  ].filter((part): part is string => part !== null)
  const sentences = ['Routing is on.']
  if (used.length > 0) sentences.push(`${capitalised(used.join(', '))}.`)
  if (!facts.defaultProxy) sentences.push('Everything else connects directly.')
  return sentences.join(' ')
}

function setAsideSummary (counts: SetAsideCounts): SetAsideSummary {
  const links = SET_ASIDE_KINDS
    .filter(kind => kind.countOf(counts) > 0)
    .map(kind => ({
      label: countPhrase(kind.countOf(counts), kind.singular, kind.plural),
      section: kind.section,
    }))
  const total = SET_ASIDE_KINDS.reduce((sum, kind) => sum + kind.countOf(counts), 0)
  return { total, sentence: total === 0 ? '' : setAsideSentence(total), links }
}

function setAsideSentence (total: number): string {
  return total === 1
    ? '1 entry is not used because it is invalid:'
    : `${total} entries are not used because they are invalid:`
}

function routeRows (facts: HomeFacts, browser: HomeBrowser): RouteRow[] {
  const isFirefox = browser === 'firefox'
  return [
    {
      label: 'Tab proxy',
      section: isFirefox ? 'defaults' : undefined,
      value: isFirefox ? tabProxyValue(facts.tabsWithProxy) : undefined,
      note: isFirefox ? 'Set from the popup.' : undefined,
      badge: isFirefox ? undefined : 'firefox',
    },
    {
      label: 'Sites',
      section: 'sites',
      value: countPhrase(facts.sites, 'site', 'sites'),
      fixNote: fixNoteFor(facts.setAside.sites),
      badge: isFirefox ? undefined : 'limited',
    },
    {
      label: 'Rules',
      section: 'rules',
      value: rulesValue(facts),
      fixNote: fixNoteFor(facts.setAside.rules),
    },
    defaultProxyRow(facts),
    { label: 'Everything else', value: 'Connects directly' },
  ]
}

function rulesValue (facts: HomeFacts): string {
  if (facts.activeRules + facts.offRules === 0) return countPhrase(0, 'rule', 'rules')
  return `${facts.activeRules} active, ${facts.offRules} off`
}

function capitalised (text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function defaultProxyRow (facts: HomeFacts): RouteRow {
  if (facts.defaultProxy) return { label: 'Default proxy', section: 'defaults', value: proxyLabel(facts.defaultProxy) }
  if (facts.defaultProxyStored) return { label: 'Default proxy', section: 'defaults', badge: 'unavailable' }
  return { label: 'Default proxy', section: 'defaults', value: 'None' }
}

function proxiesSummary (facts: HomeFacts, browser: HomeBrowser): ProxiesSummary {
  return {
    count: facts.proxies.length,
    fixNote: fixNoteFor(facts.setAside.proxies),
    keepAliveRules: facts.keepAliveRules,
    keepAliveBadge: browser === 'firefox' ? undefined : 'firefox',
    notifyIfDown: facts.notifyIfDown,
  }
}

function tabProxyValue (tabs: number): string {
  if (tabs === 0) return 'No tab has a proxy'
  return `${tabs} ${tabs === 1 ? 'tab has' : 'tabs have'} a proxy`
}

function fixNoteFor (count: number): string | undefined {
  return count > 0 ? needsFixingPhrase(count) : undefined
}

export function needsFixingPhrase (count: number): string {
  return count === 1 ? '1 needs fixing' : `${count} need fixing`
}

function proxyLabel (proxy: ProxyListItem): string {
  return proxy.label || proxy.host
}

export function keepAliveRulesPhrase (count: number): string {
  return count === 0 ? 'no rules' : countPhrase(count, 'rule', 'rules')
}

export function countPhrase (count: number, singular: string, plural: string): string {
  if (count === 0) return `No ${plural}`
  return `${count} ${count === 1 ? singular : plural}`
}
