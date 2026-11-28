import { supportsProxyOnRequest } from '@utils/env'
import { faultRowsOf } from '@utils/ruleFaults'
import type { RuleForm } from '@utils/ruleDraft'
import { chromeIgnoresLimits, resourceTypeHelpOf, summaryPhrasesShown, tuningPhrasesOf } from '@utils/ruleTuning'
import type { TuningPhrase } from '@utils/ruleTuning'
import { badge, banner } from '../components/feedback'
import type { Fault } from '../components/sheet'
import { switchControl, segmented } from '../components/controls'
import type { SegmentOption } from '../components/controls'
import { disclosure } from '../components/disclosure'
import { switchField, textField } from '../components/fields'
import { patternList } from '../components/pattern-list'
import { typeGrid } from '../components/type-grid'
import { element } from '../dom'
import type { Child } from '../dom'

const FINE_TUNING_FIELDS: readonly string[] = [
  'bypassUrlPatterns', 'forceProxyUrlPatterns', 'resourceTypeMode', 'staticExtensions', 'proxyOnlyPageHostnames',
]
const INTRO_TEXT = 'Every matching request uses the proxy unless an option here narrows it.'
const CHROME_LIMITS_TEXT = 'On Chrome these limits are ignored, so this rule proxies every request to its hosts. They take effect in Firefox.'
const NEVER_HOSTS_HELP = 'Matching requests connect directly. Matched by scheme and host; a path in the pattern is ignored.'
const ALWAYS_HOSTS_HELP = "Wins over 'Never proxy these hosts', 'Never proxy files matching', and the limits below."
const HOST_PLACEHOLDER = '*://cdn.example.com/*'
const RESOURCE_TYPES_CHROME_NOTE = 'Chrome does not tell extensions the kind of request, so it ignores this.'
const BOTH_LISTS_TEXT = "This rule has both a 'never proxy' and an 'only proxy' type list. Saving keeps the mode shown here."
const FILES_HELP = 'A JavaScript regular expression tested against the path, such as /\\.(jpg|png|css)$/.'
const FILES_CHROME_NOTE = 'On Chrome this works for http:// addresses only. Chrome hides the path of https:// addresses from extensions.'
const PAGE_HELP = 'The rule applies only to requests made by pages on these sites or their subdomains. Requests that belong to no page connect directly. Leave empty to apply on every page.'
const PAGE_CHROME_NOTE = 'Chrome does not tell extensions which page a request belongs to, so it ignores this.'
const SITE_PLACEHOLDER = 'example.com'
const CONNECT_DIRECTLY_HELP = 'For this rule only. Sites and the default proxy follow the switch in Defaults.'
const MODE_OPTIONS: SegmentOption<'never' | 'only'>[] = [
  { value: 'never', label: 'Never proxy these' },
  { value: 'only', label: 'Only proxy these' },
]

export function fineTuningDisclosure (form: RuleForm, faults: Fault[]): HTMLDetailsElement {
  const chrome = !supportsProxyOnRequest
  const phrases = tuningPhrasesOf(form)
  return disclosure('Fine tuning', summaryNodes(phrases, chrome, phrases.length === 0 ? undefined : 'Tuned: '),
    phrases.length > 0 || faults.some(fault => FINE_TUNING_FIELDS.includes(fault.field)),
    element('p', { class: 'help' }, INTRO_TEXT),
    chrome && chromeIgnoresLimits(form) ? banner({ tone: 'info', text: CHROME_LIMITS_TEXT }) : null,
    hostGroup(form, faults),
    resourceTypeGroup(form, faults, chrome),
    pageGroup(form, faults, chrome),
    connectDirectlyGroup(form),
  )
}

export function rowTuningNodes (form: RuleForm): Child[] {
  const phrases = tuningPhrasesOf(form)
  if (phrases.length === 0) return []
  const { shown, hiddenCount } = summaryPhrasesShown(phrases)
  return [summaryNodes(shown, !supportsProxyOnRequest, 'Tuned: '), hiddenCount > 0 ? ` +${hiddenCount} more` : null]
}

function summaryNodes (phrases: TuningPhrase[], chrome: boolean, prefix?: string): Child {
  if (phrases.length === 0) return 'Not tuned'
  const firstIgnored = chrome ? phrases.findIndex(phrase => phrase.firefoxOnly) : -1
  const parts = phrases.flatMap((phrase, index): Child[] => [
    index === 0 ? null : ', ',
    index === firstIgnored ? badge('firefox') : null,
    index === firstIgnored ? ' ' : null,
    phrase.text,
  ])
  return element('span', {}, prefix ?? '', ...parts)
}

function hostGroup (form: RuleForm, faults: Fault[]): HTMLElement {
  return group('By host', null,
    patternList({
      field: 'bypassUrlPatterns', label: 'Never proxy these hosts', patterns: form.bypassUrlPatterns,
      faults: faultRowsOf(faults, 'bypassUrlPatterns'), placeholder: HOST_PLACEHOLDER, help: NEVER_HOSTS_HELP,
    }),
    patternList({
      field: 'forceProxyUrlPatterns', label: 'Always proxy these hosts', patterns: form.forceProxyUrlPatterns,
      faults: faultRowsOf(faults, 'forceProxyUrlPatterns'), placeholder: HOST_PLACEHOLDER, help: ALWAYS_HOSTS_HELP,
    }),
  )
}

function resourceTypeGroup (form: RuleForm, faults: Fault[], chrome: boolean): HTMLElement {
  const modeFault = faults.find(fault => fault.field === 'resourceTypeMode')?.message
  return group('By kind of request', null,
    element('div', { class: modeFault ? 'field field--invalid' : 'field' },
      segmented(resourceTypesLegend(chrome), 'resourceTypeMode', MODE_OPTIONS, form.resourceTypeMode),
      element('p', { class: 'help' }, resourceTypeHelpOf(form)),
      chrome ? element('p', { class: 'help' }, RESOURCE_TYPES_CHROME_NOTE) : null,
      modeFault ? element('p', { class: 'field__error' }, modeFault) : null,
    ),
    bothListsBanner(form),
    unknownTypesNote(faults),
    element('div', { 'data-show-when': 'resourceTypeMode=never' },
      typeGrid('neverResourceTypes', 'Types that connect directly', form.neverResourceTypes)),
    element('div', { 'data-show-when': 'resourceTypeMode=only' },
      typeGrid('onlyResourceTypes', 'Types that use the proxy', form.onlyResourceTypes)),
    textField({
      name: 'staticExtensions', label: 'Never proxy files matching', value: form.staticExtensions, mono: true,
      help: FILES_HELP, fault: faults.find(fault => fault.field === 'staticExtensions')?.message,
      badge: chrome ? badge('limited') : undefined,
    }),
    chrome ? element('p', { class: 'help' }, FILES_CHROME_NOTE) : null,
  )
}

export const UNKNOWN_TYPES_FIELD = 'unknownResourceTypes'

function unknownTypesNote (faults: Fault[]): HTMLElement | null {
  const message = faults.find(fault => fault.field === UNKNOWN_TYPES_FIELD)?.message
  return message ? element('p', { class: 'field__error' }, message) : null
}

function bothListsBanner (form: RuleForm): HTMLElement | null {
  const bothListsStored = form.neverResourceTypes.length > 0 && form.onlyResourceTypes.length > 0
  return bothListsStored ? banner({ tone: 'info', text: BOTH_LISTS_TEXT }) : null
}

function resourceTypesLegend (chrome: boolean): Child {
  return chrome ? element('span', {}, 'Resource types', ' ', badge('firefox')) : 'Resource types'
}

function pageGroup (form: RuleForm, faults: Fault[], chrome: boolean): HTMLElement {
  return group('By page', chrome ? badge('firefox') : null,
    patternList({
      field: 'proxyOnlyPageHostnames', label: 'Only when the page is on', patterns: form.proxyOnlyPageHostnames,
      faults: faultRowsOf(faults, 'proxyOnlyPageHostnames'), placeholder: SITE_PLACEHOLDER, help: PAGE_HELP, addLabel: 'Add site',
    }),
    chrome ? element('p', { class: 'help' }, PAGE_CHROME_NOTE) : null,
  )
}

function connectDirectlyGroup (form: RuleForm): HTMLElement {
  return group('If the proxy fails', null,
    switchField({
      label: 'Connect directly instead',
      control: switchControl('Connect directly instead', form.fallbackDirect, undefined, { field: 'fallbackDirect' }),
      help: CONNECT_DIRECTLY_HELP,
    }),
  )
}

function group (title: string, note: Child, ...children: Child[]): HTMLElement {
  return element('div', { class: 'rule-group' },
    element('h3', { class: 'rule-group__title' }, title, note ? ' ' : null, note),
    ...children,
  )
}
