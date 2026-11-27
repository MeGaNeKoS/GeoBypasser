import type { ProxyRule } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { proxyOptions } from '@utils/pageView'
import { faultFor, draftFlag, draftOf, draftValue, draftValues, openSheet } from '../components/sheet'
import type { Draft, Fault } from '../components/sheet'
import { switchControl } from '../components/controls'
import { selectField, textField } from '../components/fields'
import { patternList } from '../components/pattern-list'
import { element } from '../dom'
import { faultRowsOf, ruleFormFaults } from '@utils/ruleFaults'
import { ruleFormOf, ruleListSavingAt, ruleListWithNew, storedRuleOf } from '@utils/ruleDraft'
import type { ResourceTypeMode, RuleForm } from '@utils/ruleDraft'
import { fineTuningDisclosure } from './ruleFineTuning'
import { changeRuleList } from './ruleStore'

export type RuleEntry = { raw: unknown; position: number; invalid: boolean };

export type RuleEditorOptions = {
  entry?: RuleEntry;
  proxyList: unknown;
  onSaved: (saved: boolean) => void;
}

const MATCH_PLACEHOLDER = '*://*.example.com/*'
const MATCH_HELP = 'Matched by scheme and host, such as *://*.example.com/*. A path in the pattern is ignored.'
const UNAVAILABLE_PREFIX = 'Unavailable: '
const DIRECT_LABEL = 'Direct'
const CHOOSE_PROXY_LABEL = 'Choose a proxy'

export function openRuleEditor (options: RuleEditorOptions): void {
  const form = ruleFormOf(storedRuleOf(options.entry?.raw))
  openSheet({
    title: options.entry ? 'Edit rule' : 'Add rule',
    saveLabel: 'Save',
    draft: draftOf({ ...form }),
    initialFaults: options.entry?.invalid ? ruleFormFaults(form) : undefined,
    render: (draft, faults) => renderFields(formFromDraft(draft), faults, options.proxyList),
    validate: draft => ruleFormFaults(formFromDraft(draft)),
    save: draft => {
      const form = formFromDraft(draft)
      void changeRuleList(list => listWithSaved(list, form, options.entry))
        .then(saved => options.onSaved(saved))
    },
  })
}

function listWithSaved (list: ProxyRule[], form: RuleForm, entry: RuleEntry | undefined): ProxyRule[] | undefined {
  if (!entry) return ruleListWithNew(list, form)
  return ruleListSavingAt(list, entry.position, entry.raw, form)
}

function formFromDraft (draft: Draft): RuleForm {
  return {
    name: draftValue(draft, 'name'),
    active: draftFlag(draft, 'active'),
    proxyId: draftValue(draft, 'proxyId'),
    match: draftValues(draft, 'match'),
    resourceTypeMode: draftValue(draft, 'resourceTypeMode') as ResourceTypeMode,
    neverResourceTypes: draftValues(draft, 'neverResourceTypes'),
    onlyResourceTypes: draftValues(draft, 'onlyResourceTypes'),
    bypassUrlPatterns: draftValues(draft, 'bypassUrlPatterns'),
    forceProxyUrlPatterns: draftValues(draft, 'forceProxyUrlPatterns'),
    staticExtensions: draftValue(draft, 'staticExtensions'),
    proxyOnlyPageHostnames: draftValues(draft, 'proxyOnlyPageHostnames'),
    fallbackDirect: draftFlag(draft, 'fallbackDirect'),
  }
}

function renderFields (form: RuleForm, faults: Fault[], proxyList: unknown): Node[] {
  return [
    textField({ name: 'name', label: 'Name', value: form.name, fault: faultFor(faults, 'name') }),
    activeField(form),
    sendThroughField(form, proxyList, faultFor(faults, 'proxyId')),
    patternList({
      field: 'match', label: 'Match patterns', patterns: form.match, faults: faultRowsOf(faults, 'match'),
      placeholder: MATCH_PLACEHOLDER, help: MATCH_HELP,
    }),
    fineTuningDisclosure(form, faults),
  ]
}

function activeField (form: RuleForm): HTMLElement {
  return element('div', { class: 'field' },
    element('span', { class: 'field__label' }, 'Active'),
    switchControl('Active', form.active, undefined, { field: 'active' }),
  )
}

function sendThroughField (form: RuleForm, proxyList: unknown, fault: string | undefined): HTMLElement {
  const usable = proxyOptions(proxyList).map(proxy => ({ value: proxy.id, label: proxy.label || proxy.host }))
  const known = form.proxyId === '' || form.proxyId === DIRECT_PROXY_ID || usable.some(option => option.value === form.proxyId)
  const unavailable = known ? [] : [{ value: form.proxyId, label: `${UNAVAILABLE_PREFIX}${form.proxyId}`, disabled: true }]
  const placeholder = form.proxyId === '' ? [{ value: '', label: CHOOSE_PROXY_LABEL }] : []
  return selectField({
    name: 'proxyId', label: 'Send through', fault,
    options: [...placeholder, { value: DIRECT_PROXY_ID, label: DIRECT_LABEL }, ...usable, ...unavailable],
    selected: form.proxyId,
  })
}
