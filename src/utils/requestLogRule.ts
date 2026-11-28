import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import type { ProxyRule } from '@customTypes/proxy'
import type { RequestLogRow } from './requestLog'
import { ruleFormOf, type RuleForm } from './ruleDraft'

export type LogSelection = {
  page: string;
  hosts: string[];
  types: { host: string; type: string }[];
};

export type SkipRule = { index: number; name: string };

export function skippableRuleOf (row: RequestLogRow, rules: ProxyRule[]): SkipRule | undefined {
  for (const line of row.routes) {
    if (line.reason !== 'rule' || line.ruleId === undefined || line.ruleName === undefined) continue
    if (rules[line.ruleId]?.name === line.ruleName) return { index: line.ruleId, name: line.ruleName }
  }
  return undefined
}

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

export function selectionOnPage (selection: LogSelection | undefined, page: string): LogSelection {
  return selection?.page === page ? selection : { page, hosts: [], types: [] }
}

export function withHostToggled (selection: LogSelection, host: string): LogSelection {
  if (selection.hosts.includes(host)) {
    return { ...selection, hosts: selection.hosts.filter(entry => entry !== host), types: selection.types.filter(entry => entry.host !== host) }
  }
  return { ...selection, hosts: [...selection.hosts, host] }
}

export function withTypeToggled (selection: LogSelection, host: string, type: string): LogSelection {
  const selected = selection.types.some(entry => entry.host === host && entry.type === type)
  if (selected) return { ...selection, types: selection.types.filter(entry => !(entry.host === host && entry.type === type)) }
  return { ...selection, hosts: selection.hosts.includes(host) ? selection.hosts : [...selection.hosts, host], types: [...selection.types, { host, type }] }
}

export function ruleFormSkippingHost (form: RuleForm, host: string): RuleForm {
  return { ...form, bypassUrlPatterns: [...form.bypassUrlPatterns, hostMatchPattern(host)] }
}

function knownTypesOf (types: string[]): string[] {
  return [...new Set(types)].filter(type => WEB_REQUEST_RESOURCE_TYPES.some(known => known === type))
}
