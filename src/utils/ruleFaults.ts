import { nonBlank } from '@utils/ruleDraft'
import type { RuleForm, RuleFormField } from '@utils/ruleDraft'
import { isValidPattern, isValidStaticExtensions, validateHostnamePattern } from '@utils/validity'

export type RowFault = {
  field: string;
  message: string;
  row?: number;
}

export type RuleFault = {
  field: RuleFormField;
  message: string;
  row?: number;
}

const NAME_FAULT = 'Give the rule a name.'
const MATCH_EMPTY_FAULT = 'Add at least one match pattern.'
const PROXY_FAULT = 'Choose the proxy this rule sends requests through.'
const STATIC_EXTENSIONS_FAULT = 'Not a valid regular expression. Write it between slashes, such as /\\.(jpg|png)$/.'

function patternRowFault (row: number): string {
  return `Pattern ${row + 1} is not a valid match pattern.`
}

function siteRowFault (row: number): string {
  return `Site ${row + 1} is not valid. Use a host name such as example.com or *.example.com.`
}

export function ruleFormFaults (form: RuleForm): RuleFault[] {
  return [
    ...nameFaults(form),
    ...matchFaults(form.match),
    ...proxyFaults(form),
    ...rowFaults('bypassUrlPatterns', form.bypassUrlPatterns, isValidPattern, patternRowFault),
    ...rowFaults('forceProxyUrlPatterns', form.forceProxyUrlPatterns, isValidPattern, patternRowFault),
    ...rowFaults('proxyOnlyPageHostnames', form.proxyOnlyPageHostnames, validateHostnamePattern, siteRowFault),
    ...staticExtensionsFaults(form.staticExtensions),
  ]
}

export function faultRowsOf (faults: readonly RowFault[], field: string): Record<number, string> {
  const rows: Record<number, string> = {}
  for (const fault of faults) {
    if (fault.field === field && fault.row !== undefined) rows[fault.row] = fault.message
  }
  return rows
}

function nameFaults (form: RuleForm): RuleFault[] {
  return form.name.trim() === '' ? [{ field: 'name', message: NAME_FAULT }] : []
}

function matchFaults (match: string[]): RuleFault[] {
  const faults: RuleFault[] = nonBlank(match).length === 0 ? [{ field: 'match', message: MATCH_EMPTY_FAULT }] : []
  return [...faults, ...rowFaults('match', match, isValidPattern, patternRowFault)]
}

function proxyFaults (form: RuleForm): RuleFault[] {
  return form.proxyId === '' ? [{ field: 'proxyId', message: PROXY_FAULT }] : []
}

function staticExtensionsFaults (value: string): RuleFault[] {
  const trimmed = value.trim()
  return trimmed !== '' && !isValidStaticExtensions(trimmed)
    ? [{ field: 'staticExtensions', message: STATIC_EXTENSIONS_FAULT }]
    : []
}

function rowFaults (
  field: RuleFormField,
  rows: string[],
  isValid: (value: string) => boolean,
  messageOf: (row: number) => string,
): RuleFault[] {
  return rows.flatMap((value, row) => {
    const trimmed = value.trim()
    return trimmed !== '' && !isValid(trimmed) ? [{ field, row, message: messageOf(row) }] : []
  })
}
