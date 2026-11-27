import type { ProxyRule } from '@customTypes/proxy'
import { mergeEditedFields, RULE_FORM_FIELDS } from '@utils/editFields'
import { isRuleActive } from '@utils/usable'

export type ResourceTypeMode = 'never' | 'only'

export type RuleForm = {
  name: string;
  active: boolean;
  proxyId: string;
  match: string[];
  resourceTypeMode: ResourceTypeMode;
  neverResourceTypes: string[];
  onlyResourceTypes: string[];
  bypassUrlPatterns: string[];
  forceProxyUrlPatterns: string[];
  staticExtensions: string;
  proxyOnlyPageHostnames: string[];
  fallbackDirect: boolean;
}

export type RuleFormField = keyof RuleForm

export function ruleFormOf (rule?: ProxyRule): RuleForm {
  const onlyResourceTypes = rule?.proxyOnlyResourceTypes ?? []
  return {
    name: rule?.name ?? '',
    active: rule ? isRuleActive(rule) : true,
    proxyId: rule?.proxyId ?? '',
    match: rule?.match ?? [],
    resourceTypeMode: onlyResourceTypes.length > 0 ? 'only' : 'never',
    neverResourceTypes: rule?.bypassResourceTypes ?? [],
    onlyResourceTypes,
    bypassUrlPatterns: rule?.bypassUrlPatterns ?? [],
    forceProxyUrlPatterns: rule?.forceProxyUrlPatterns ?? [],
    staticExtensions: rule?.staticExtensions ?? '',
    proxyOnlyPageHostnames: rule?.proxyOnlyPageHostnames ?? [],
    fallbackDirect: rule?.fallbackDirect === true,
  }
}

export function ruleFromForm (form: RuleForm, stored?: ProxyRule): ProxyRule {
  const edited: ProxyRule = {
    name: form.name.trim(),
    active: form.active,
    proxyId: form.proxyId,
    match: nonBlank(form.match),
    ...listField('bypassUrlPatterns', nonBlank(form.bypassUrlPatterns)),
    ...listField('forceProxyUrlPatterns', nonBlank(form.forceProxyUrlPatterns)),
    ...resourceTypeFields(form),
    ...listField('proxyOnlyPageHostnames', nonBlank(form.proxyOnlyPageHostnames)),
    ...optionalText('staticExtensions', form.staticExtensions.trim()),
    ...(form.fallbackDirect ? { fallbackDirect: true } : {}),
  }
  return mergeEditedFields(stored, edited, RULE_FORM_FIELDS)
}

export function ruleListSavingAt (list: unknown[], position: number, opened: unknown, form: RuleForm): ProxyRule[] | undefined {
  if (!sameRule(list[position], opened)) return undefined
  return list.map((entry, index) => index === position ? ruleFromForm(form, storedRuleOf(entry)) : entry) as ProxyRule[]
}

export function ruleListWithNew (list: ProxyRule[], form: RuleForm): ProxyRule[] {
  return [...list, ruleFromForm(form)]
}

export function nonBlank (values: string[]): string[] {
  return values.map(value => value.trim()).filter(value => value !== '')
}

function resourceTypeFields (form: RuleForm): Partial<ProxyRule> {
  if (form.resourceTypeMode === 'only') return listField('proxyOnlyResourceTypes', form.onlyResourceTypes)
  return listField('bypassResourceTypes', form.neverResourceTypes)
}

function listField<K extends keyof ProxyRule> (key: K, values: string[]): Partial<ProxyRule> {
  return values.length > 0 ? { [key]: values } : {}
}

function optionalText (key: 'staticExtensions', value: string): Partial<ProxyRule> {
  return value !== '' ? { [key]: value } : {}
}

export function storedRuleOf (entry: unknown): ProxyRule | undefined {
  return typeof entry === 'object' && entry !== null ? entry as ProxyRule : undefined
}

function sameRule (entry: unknown, opened: unknown): boolean {
  return JSON.stringify(entry ?? null) === JSON.stringify(opened ?? null)
}
