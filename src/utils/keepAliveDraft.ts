import type { KeepAliveProxyRule } from '@customTypes/proxy'
import { KEEP_ALIVE_FORM_FIELDS, mergeEditedFields } from '@utils/editFields'
import { isChosenProxyId, isValidTestUrl, validateHostnamePattern } from '@utils/validity'

export type KeepAliveMap = KeepAliveProxyRule
type KeepAliveEntry = KeepAliveProxyRule[string]

export type KeepAliveForm = {
  proxyId: string;
  active: boolean;
  tabUrls: string[];
  testProxyUrl: string;
}

type KeepAliveFault = {
  field: keyof KeepAliveForm;
  message: string;
  row?: number;
}

const NO_PROXY_FAULT = 'No proxy is chosen for this rule.'
const NO_TAB_URL_FAULT = 'Add at least one tab URL pattern.'
const ACTIVE_FAULT = 'Choose on or off.'
const TEST_URL_FAULT = 'Test URL must be an http or https address, or empty to use the default.'

function fault (field: keyof KeepAliveForm, message: string, row?: number): KeepAliveFault {
  return { field, message, row }
}

export function keepAliveRuleFaults (rule: { tabUrls?: unknown; active?: unknown }): KeepAliveFault[] {
  const tabUrls: unknown[] = Array.isArray(rule.tabUrls) ? rule.tabUrls : []
  return [
    ...(tabUrls.length > 0 ? [] : [fault('tabUrls', NO_TAB_URL_FAULT)]),
    ...tabUrls.flatMap((url, row) => (typeof url === 'string' && validateHostnamePattern(url)
      ? []
      : [fault('tabUrls', `Tab URL pattern ${row + 1} is not valid.`, row)])),
    ...(typeof rule.active === 'boolean' ? [] : [fault('active', ACTIVE_FAULT)]),
  ]
}

function proxyFaults (form: KeepAliveForm): KeepAliveFault[] {
  return isChosenProxyId(form.proxyId) ? [] : [fault('proxyId', NO_PROXY_FAULT)]
}

function testUrlFaults (form: KeepAliveForm): KeepAliveFault[] {
  return form.testProxyUrl === '' || isValidTestUrl(form.testProxyUrl) ? [] : [fault('testProxyUrl', TEST_URL_FAULT)]
}

export function keepAliveFormFaults (form: KeepAliveForm): KeepAliveFault[] {
  return [...proxyFaults(form), ...keepAliveRuleFaults(form), ...testUrlFaults(form)]
}

export function keepAliveStoredFaults (proxyId: string, rule: unknown): KeepAliveFault[] {
  return [...keepAliveRuleFaults(recordOf(rule)), ...testUrlFaults(keepAliveFormOf(proxyId, rule))]
}

export function keepAliveFormOf (proxyId: string, rule: unknown): KeepAliveForm {
  const stored = recordOf(rule)
  return {
    proxyId,
    active: stored.active === true,
    tabUrls: Array.isArray(stored.tabUrls) ? stored.tabUrls.map(String) : [],
    testProxyUrl: typeof stored.testProxyUrl === 'string' ? stored.testProxyUrl : '',
  }
}

export function keepAliveMapAfterSave (map: KeepAliveMap, form: KeepAliveForm, previousProxyId: string | undefined): KeepAliveMap {
  const others = Object.entries(map).filter(([proxyId]) => proxyId !== previousProxyId)
  const stored = previousProxyId === undefined ? undefined : map[previousProxyId]
  return { ...Object.fromEntries(others), [form.proxyId]: mergeEditedFields(stored, entryOf(form), KEEP_ALIVE_FORM_FIELDS) }
}

export function keepAliveMapWithout (map: KeepAliveMap, proxyIds: string[]): KeepAliveMap {
  return Object.fromEntries(Object.entries(map).filter(([proxyId]) => !proxyIds.includes(proxyId)))
}

function entryOf (form: KeepAliveForm): KeepAliveEntry {
  return {
    active: form.active,
    tabUrls: form.tabUrls,
    ...(form.testProxyUrl === '' ? {} : { testProxyUrl: form.testProxyUrl }),
  }
}

function recordOf (value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
