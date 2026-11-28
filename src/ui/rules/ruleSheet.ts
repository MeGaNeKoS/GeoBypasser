import type { ProxyRule } from '@customTypes/proxy'
import { faultFor, draftFlag, draftOf, draftValue, draftValues, openSheet } from '../components/sheet'
import type { Draft, Fault } from '../components/sheet'
import { switchControl } from '../components/controls'
import { switchField, textField } from '../components/fields'
import { proxySelectField } from '../components/proxy-select'
import { patternList } from '../components/pattern-list'
import { element } from '../dom'
import { faultRowsOf, ruleFormFaults } from '@utils/ruleFaults'
import { unknownResourceTypesOf } from '@utils/setAsideReasons'
import { ruleFormOf, ruleListSavingAt, ruleListWithNew, storedRuleOf } from '@utils/ruleDraft'
import type { ResourceTypeMode, RuleForm } from '@utils/ruleDraft'
import { UNKNOWN_TYPES_FIELD, fineTuningDisclosure } from './ruleFineTuning'
import { changeRuleList } from './ruleStore'

export type RuleEntry = { raw: unknown; position: number; invalid: boolean };

export type RuleEditorOptions = {
  entry?: RuleEntry;
  proxyList: unknown;
  onSaved: (saved: boolean) => void;
}

const MATCH_PLACEHOLDER = '*://*.example.com/*'
const MATCH_HELP = 'Matched by scheme and host, such as *://*.example.com/*. A path in the pattern is ignored.'

export function openRuleEditor (options: RuleEditorOptions): void {
  const form = ruleFormOf(storedRuleOf(options.entry?.raw))
  openSheet({
    title: options.entry ? 'Edit rule' : 'Add rule',
    saveLabel: 'Save',
    draft: draftOf({ ...form }),
    initialFaults: initialFaultsOf(options.entry, form),
    render: (draft, faults) => renderFields(formFromDraft(draft), faults, options.proxyList),
    validate: draft => ruleFormFaults(formFromDraft(draft)),
    save: draft => {
      const form = formFromDraft(draft)
      void changeRuleList(list => listWithSaved(list, form, options.entry))
        .then(saved => options.onSaved(saved))
    },
  })
}

function initialFaultsOf (entry: RuleEntry | undefined, form: RuleForm): Fault[] | undefined {
  const unknownTypes = unknownResourceTypesOf(entry?.raw)
  const unknownFaults = unknownTypes.length === 0 ? [] : [unknownTypesFault(unknownTypes)]
  const formFaults = entry?.invalid ? ruleFormFaults(form) : []
  const faults = [...formFaults, ...unknownFaults]
  return faults.length === 0 ? undefined : faults
}

function unknownTypesFault (types: string[]): Fault {
  return {
    field: UNKNOWN_TYPES_FIELD,
    message: `This rule stores a type this version does not know: ${types.join(', ')}. Saving removes it.`,
  }
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
  return switchField({ label: 'Active', control: switchControl('Active', form.active, undefined, { field: 'active' }) })
}

function sendThroughField (form: RuleForm, proxyList: unknown, fault: string | undefined): HTMLElement {
  return proxySelectField({ name: 'proxyId', label: 'Send through', proxyList, proxyId: form.proxyId, fault })
}
