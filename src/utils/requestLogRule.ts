import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import { ruleFormOf, type RuleForm } from './ruleDraft'

export type LogSelection = {
  page: string;
  hosts: string[];
  types: { host: string; type: string }[];
};

export function hostMatchPattern (host: string): string {
  return `*://${host}/*`
}

export function ruleFormForSelection (selection: LogSelection, perTypeRules: boolean): RuleForm {
  const base: RuleForm = { ...ruleFormOf(), name: selection.page, match: selection.hosts.map(hostMatchPattern) }
  if (!perTypeRules) return base
  const types = knownTypesOf(selection.types.map(entry => entry.type))
  if (types.length === 0) return base
  return {
    ...base,
    proxyOnlyPageHostnames: [selection.page],
    resourceTypeMode: 'only',
    onlyResourceTypes: types,
  }
}

export function ruleFormSkippingHost (form: RuleForm, host: string): RuleForm {
  return { ...form, bypassUrlPatterns: [...form.bypassUrlPatterns, hostMatchPattern(host)] }
}

function knownTypesOf (types: string[]): string[] {
  return [...new Set(types)].filter(type => WEB_REQUEST_RESOURCE_TYPES.some(known => known === type))
}
