import { newId, upsert } from '../collections'
import { element } from '@ui/dom'
import { switchControl } from '@ui/components/controls'
import { textField } from '@ui/components/fields'
import { patternList } from '@ui/components/pattern-list'
import { proxySelect } from '../components/proxy-select'
import { draftFlag, draftOf, draftValue, draftValues, faultFor, faultsOnOpen, openSheet, type Draft, type Fault } from '@ui/components/sheet'
import type { SectionContext } from '../pages/section-context'
import { defaults, keepAliveRules } from '../sample-data'
import type { KeepAliveEntry } from '../model'
import { usableProxies } from '../proxy-lookup'

const HOST_PATTERN = /^\*?\.?([a-z0-9-]+\.)*[a-z0-9-]+$/i

export function openKeepAliveSheet (entry: KeepAliveEntry | null, context: SectionContext, proxyId?: string): void {
  const draft = keepAliveDraft(entry, proxyId)
  const validate = (current: Draft): Fault[] => validateKeepAlive(current, entry)
  openSheet({
    title: entry ? 'Edit keep-alive rule' : 'Add keep-alive rule',
    saveLabel: 'Save rule',
    draft,
    initialFaults: faultsOnOpen(entry?.faults ?? [], draft, validate),
    render: (current, faults) => keepAliveBody(current, faults),
    validate,
    save: current => saveKeepAlive(entry, current, context),
  })
}

function keepAliveDraft (entry: KeepAliveEntry | null, proxyId: string | undefined): Draft {
  return draftOf({
    proxyId: entry?.proxyId ?? proxyId ?? usableProxies()[0]?.id ?? '',
    active: entry?.active ?? true,
    tabPatterns: entry?.tabPatterns ?? [],
    testUrl: entry?.testUrl ?? '',
  })
}

function keepAliveBody (draft: Draft, faults: Fault[]): Node[] {
  const tabPatterns = draftValues(draft, 'tabPatterns')
  return [
    proxySelect({ name: 'proxyId', label: 'Proxy', selectedId: draftValue(draft, 'proxyId'), fault: faultFor(faults, 'proxyId') }),
    element('div', { class: 'field' },
      element('div', { class: 'field__row' },
        element('span', { class: 'field__label' }, 'Active'),
        switchControl('Active', draftFlag(draft, 'active'), undefined, { field: 'active' }),
      ),
    ),
    patternList({
      field: 'tabPatterns',
      label: 'Tab URL patterns',
      patterns: tabPatterns,
      faults: hostPatternFaults(tabPatterns),
      placeholder: 'example.com',
      help: 'Hostname such as example.com or *.example.com',
    }),
    textField({
      name: 'testUrl',
      label: 'Test URL',
      type: 'url',
      value: draftValue(draft, 'testUrl'),
      placeholder: defaults.testUrl,
      help: 'Leave empty to use the default test URL from Defaults.',
      fault: faultFor(faults, 'testUrl'),
    }),
  ]
}

function hostPatternFaults (patterns: string[]): Record<number, string> {
  return Object.fromEntries(patterns.flatMap((pattern, index) => HOST_PATTERN.test(pattern) ? [] : [[index, `Pattern ${index + 1} is not a valid hostname.`]]))
}

function validateKeepAlive (draft: Draft, entry: KeepAliveEntry | null): Fault[] {
  const faults: Fault[] = []
  const proxyId = draftValue(draft, 'proxyId')
  if (keepAliveRules.some(rule => rule.proxyId === proxyId && rule.id !== entry?.id)) {
    faults.push({ field: 'proxyId', message: 'This proxy already has a keep-alive rule.' })
  }
  const tabPatterns = draftValues(draft, 'tabPatterns')
  if (tabPatterns.length === 0) faults.push({ field: 'tabPatterns', message: 'Add at least one tab URL pattern.' })
  for (const message of Object.values(hostPatternFaults(tabPatterns))) {
    faults.push({ field: 'tabPatterns', message })
  }
  const testUrl = draftValue(draft, 'testUrl')
  if (testUrl !== '' && !isHttpUrl(testUrl)) {
    faults.push({ field: 'testUrl', message: 'Test URL must start with http:// or https://.' })
  }
  return faults
}

function isHttpUrl (value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function saveKeepAlive (entry: KeepAliveEntry | null, draft: Draft, context: SectionContext): void {
  upsert(keepAliveRules, {
    id: entry?.id ?? newId('keep'),
    proxyId: draftValue(draft, 'proxyId'),
    active: draftFlag(draft, 'active'),
    tabPatterns: draftValues(draft, 'tabPatterns'),
    testUrl: draftValue(draft, 'testUrl'),
    faults: [],
    notices: [],
  })
  context.refresh('Saved')
}
