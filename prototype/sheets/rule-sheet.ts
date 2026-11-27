import { element } from '@ui/dom'
import { newId, upsert } from '../collections'
import { switchControl } from '@ui/components/controls'
import { disclosure } from '@ui/components/disclosure'
import { helpToggle } from '@ui/components/help-toggle'
import { patternList } from '@ui/components/pattern-list'
import { proxySelect } from '../components/proxy-select'
import { textField } from '@ui/components/fields'
import { typeGrid } from '@ui/components/type-grid'
import { draftFlag, draftOf, draftValue, draftValues, faultFor, openSheet, type Draft, type Fault } from '@ui/components/sheet'
import { isUsable } from '../proxy-lookup'
import type { SectionContext } from '../pages/section-context'
import { defaults, rules } from '../sample-data'
import { isMatchPattern, type RuleEntry } from '../model'

const MATCH_PATTERN_HELP = 'A match pattern is a scheme, a host and a path, such as *://*.example.com/*. A * stands for any text in its place.'
const STATIC_EXTENSIONS_EXAMPLE = 'For example, /\\.(jpg|png|css)$/ matches URLs that end in .jpg, .png or .css.'

const EXCEPTION_PATTERN_FIELDS = ['bypassUrls', 'forceUrls'] as const

export function openRuleSheet (entry: RuleEntry | null, context: SectionContext): void {
  openSheet({
    title: entry ? 'Edit rule' : 'Add rule',
    saveLabel: 'Save rule',
    draft: ruleDraft(entry),
    render: (draft, faults) => ruleBody(draft, faults),
    validate: validateRule,
    save: draft => saveRule(entry, draft, context),
  })
}

function ruleDraft (entry: RuleEntry | null): Draft {
  return draftOf({
    name: entry?.name ?? '',
    active: entry?.active ?? true,
    proxyId: entry?.proxyId ?? defaults.defaultProxyId,
    matchPatterns: entry?.matchPatterns ?? [],
    fallbackDirect: entry?.fallbackDirect ?? false,
    bypassUrls: entry?.exceptions.bypassUrls ?? [],
    bypassTypes: entry?.exceptions.bypassTypes ?? [],
    staticExtensions: entry?.exceptions.staticExtensions ?? '',
    forceUrls: entry?.exceptions.forceUrls ?? [],
  })
}

function ruleBody (draft: Draft, faults: Fault[]): Node[] {
  const matchPatterns = draftValues(draft, 'matchPatterns')
  return [
    element('h3', { class: 'group-label' }, 'Basics'),
    textField({ name: 'name', label: 'Name', value: draftValue(draft, 'name'), fault: faultFor(faults, 'name') }),
    element('div', { class: 'field' },
      element('div', { class: 'field__row' },
        element('span', { class: 'field__label' }, 'Active'),
        switchControl('Active', draftFlag(draft, 'active'), undefined, { field: 'active' }),
      ),
    ),
    proxySelect({ name: 'proxyId', label: 'Send through', selectedId: draftValue(draft, 'proxyId'), fault: faultFor(faults, 'proxyId') }),
    patternList({
      field: 'matchPatterns',
      label: 'Match patterns',
      patterns: matchPatterns,
      faults: patternFaults(matchPatterns, 'Match pattern'),
      placeholder: '*://*.example.com/*',
      help: 'Hostname with wildcards, such as *://*.example.com/*.',
      addRowAside: helpToggle('What is a match pattern?', MATCH_PATTERN_HELP),
    }),
    element('h3', { class: 'group-label' }, 'If the proxy fails'),
    element('div', { class: 'field' },
      element('div', { class: 'field__row' },
        element('span', { class: 'field__label' }, 'Connect directly instead'),
        switchControl('Connect directly instead', draftFlag(draft, 'fallbackDirect'), undefined, { field: 'fallbackDirect' }),
      ),
    ),
    exceptionsGroup(draft, faults),
  ]
}

function exceptionsGroup (draft: Draft, faults: Fault[]): HTMLDetailsElement {
  const open = exceptionsInUse(draft) > 0 || faults.some(fault => isExceptionField(fault.field))
  return disclosure('Exceptions', exceptionsState(draft), open,
    patternList({
      field: 'bypassUrls',
      label: 'Never proxy these URLs',
      patterns: draftValues(draft, 'bypassUrls'),
      faults: patternFaults(draftValues(draft, 'bypassUrls'), 'Never-proxy pattern'),
      placeholder: '*://*.example.com/api/*',
    }),
    patternList({
      field: 'forceUrls',
      label: 'Always proxy these URLs',
      patterns: draftValues(draft, 'forceUrls'),
      faults: patternFaults(draftValues(draft, 'forceUrls'), 'Always-proxy pattern'),
      placeholder: '*://*.example.com/api/*',
    }),
    typeGrid('bypassTypes', 'Never proxy these resource types', draftValues(draft, 'bypassTypes')),
    textField({
      name: 'staticExtensions',
      label: 'Static extensions',
      value: draftValue(draft, 'staticExtensions'),
      mono: true,
      help: 'A JavaScript regular expression.',
      fault: faultFor(faults, 'staticExtensions'),
    }),
    helpToggle('Examples', STATIC_EXTENSIONS_EXAMPLE),
  )
}

function exceptionsInUse (draft: Draft): number {
  const staticSet = draftValue(draft, 'staticExtensions') === '' ? 0 : 1
  return draftValues(draft, 'bypassUrls').length + draftValues(draft, 'forceUrls').length + draftValues(draft, 'bypassTypes').length + staticSet
}

function exceptionsState (draft: Draft): string {
  const count = exceptionsInUse(draft)
  return count === 0 ? 'None in use' : `${count} in use`
}

function isExceptionField (field: string): boolean {
  return field === 'staticExtensions' || (EXCEPTION_PATTERN_FIELDS as readonly string[]).includes(field)
}

function patternFaults (patterns: string[], noun: string): Record<number, string> {
  return Object.fromEntries(patterns.flatMap((pattern, index) => isMatchPattern(pattern) ? [] : [[index, `${noun} ${index + 1} is not valid.`]]))
}

function validateRule (draft: Draft): Fault[] {
  const faults: Fault[] = []
  if (draftValue(draft, 'name').trim() === '') faults.push({ field: 'name', message: 'Name is missing.' })
  if (!isUsable(draftValue(draft, 'proxyId'))) faults.push({ field: 'proxyId', message: 'Choose a usable proxy, or Direct.' })
  const matchPatterns = draftValues(draft, 'matchPatterns')
  if (matchPatterns.length === 0) faults.push({ field: 'matchPatterns', message: 'Add at least one match pattern.' })
  for (const message of Object.values(patternFaults(matchPatterns, 'Match pattern'))) {
    faults.push({ field: 'matchPatterns', message })
  }
  for (const field of EXCEPTION_PATTERN_FIELDS) {
    for (const message of Object.values(patternFaults(draftValues(draft, field), 'Pattern'))) {
      faults.push({ field, message })
    }
  }
  if (!isValidRegularExpression(draftValue(draft, 'staticExtensions'))) {
    faults.push({ field: 'staticExtensions', message: 'Static extensions is not a valid regular expression.' })
  }
  return faults
}

function isValidRegularExpression (value: string): boolean {
  if (value === '') return true
  try {
    new RegExp(value)
    return true
  } catch {
    return false
  }
}

function saveRule (entry: RuleEntry | null, draft: Draft, context: SectionContext): void {
  upsert(rules, {
    id: entry?.id ?? newId('rule'),
    name: draftValue(draft, 'name').trim(),
    active: draftFlag(draft, 'active'),
    proxyId: draftValue(draft, 'proxyId'),
    matchPatterns: draftValues(draft, 'matchPatterns'),
    fallbackDirect: draftFlag(draft, 'fallbackDirect'),
    exceptions: {
      bypassUrls: draftValues(draft, 'bypassUrls'),
      bypassTypes: draftValues(draft, 'bypassTypes'),
      staticExtensions: draftValue(draft, 'staticExtensions'),
      forceUrls: draftValues(draft, 'forceUrls'),
    },
    faults: [],
    notices: [],
  })
  context.refresh('Saved')
}
