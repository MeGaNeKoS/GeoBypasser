import type { ProxyListItem } from '@customTypes/proxy'
import type { ProxyType } from '@customTypes/generic'
import { mergeEditedFields, PROXY_FORM_FIELDS } from '@utils/editFields'
import { proxyFieldsAtFault } from '@utils/saveDecisions'

export type ProxyForm = {
  label: string;
  type: string;
  host: string;
  port: string;
  username: string;
  password: string;
  notifyIfDown: boolean;
  proxyDNS: boolean;
  failoverTimeout: string;
}

export type ProxyFormField = keyof ProxyForm

export type ProxyFormFault = {
  field: ProxyFormField;
  message: string;
}

const NEW_PROXY_DNS = true
const NEW_PROXY_TYPE: ProxyType = 'http'
const PROXY_FORM_FIELDS_EDITED: readonly (keyof ProxyListItem)[] = [...PROXY_FORM_FIELDS, 'failoverTimeout']

const PROXY_TYPE_FAULT = 'Choose HTTP or SOCKS5.'
const PROXY_HOST_FAULT = 'Enter the host name or IP address.'
const PROXY_PORT_FAULT = 'Enter a port from 1 to 65535.'
const FAILOVER_TIMEOUT_FAULT = 'Enter a whole number of seconds, 1 or more, or leave empty.'

export function proxyFormOf (proxy?: ProxyListItem): ProxyForm {
  return {
    label: proxy?.label ?? '',
    type: proxy?.type ?? NEW_PROXY_TYPE,
    host: proxy?.host ?? '',
    port: proxy ? String(proxy.port) : '',
    username: proxy?.username ?? '',
    password: proxy?.password ?? '',
    notifyIfDown: proxy?.notifyIfDown === true,
    proxyDNS: proxy?.proxyDNS ?? NEW_PROXY_DNS,
    failoverTimeout: proxy?.failoverTimeout === undefined ? '' : String(proxy.failoverTimeout),
  }
}

export function proxyFromForm (form: ProxyForm, id: string): ProxyListItem {
  const proxy: ProxyListItem = {
    id,
    type: form.type as ProxyType,
    host: form.host.trim(),
    port: Number(form.port),
    proxyDNS: form.type === 'http' ? false : form.proxyDNS,
  }
  if (form.label) proxy.label = form.label
  if (form.username) proxy.username = form.username
  if (form.password) proxy.password = form.password
  if (form.notifyIfDown) proxy.notifyIfDown = true
  const failoverTimeout = failoverTimeoutOf(form.failoverTimeout)
  if (failoverTimeout !== undefined) proxy.failoverTimeout = failoverTimeout
  return proxy
}

export function isFailoverTimeoutText (text: string): boolean {
  const trimmed = text.trim()
  return trimmed === '' || (/^\d+$/.test(trimmed) && Number(trimmed) >= 1)
}

function failoverTimeoutOf (text: string): number | undefined {
  const trimmed = text.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

export function proxyFormFaults (form: ProxyForm): ProxyFormFault[] {
  const atFault = proxyFieldsAtFault({ type: form.type, host: form.host, port: Number(form.port) })
  const faults: ProxyFormFault[] = []
  if (atFault.type) faults.push({ field: 'type', message: PROXY_TYPE_FAULT })
  if (atFault.host) faults.push({ field: 'host', message: PROXY_HOST_FAULT })
  if (atFault.port) faults.push({ field: 'port', message: PROXY_PORT_FAULT })
  if (!isFailoverTimeoutText(form.failoverTimeout)) {
    faults.push({ field: 'failoverTimeout', message: FAILOVER_TIMEOUT_FAULT })
  }
  return faults
}

export function proxyListWith (list: ProxyListItem[], proxy: ProxyListItem): ProxyListItem[] {
  const index = list.findIndex(entry => entry !== null && entry.id === proxy.id)
  if (index === -1) return [...list, proxy]
  return proxyListReplacingAt(list, index, proxy)
}

export function storedProxyOf (entry: unknown): ProxyListItem | undefined {
  return typeof entry === 'object' && entry !== null ? entry as ProxyListItem : undefined
}

export function proxyListReplacingAt (list: ProxyListItem[], position: number, proxy: ProxyListItem): ProxyListItem[] {
  return list.map((entry, index) =>
    index === position ? mergeEditedFields(storedProxyOf(entry), proxy, PROXY_FORM_FIELDS_EDITED) : entry)
}

export type DuplicateChoice = 'replace' | 'keepBoth' | 'skip'

export type ImportedProxyDecision = {
  proxy: ProxyListItem;
  duplicateIndex?: number;
  choice?: DuplicateChoice;
  copyId: string;
}

export function proxySignature (proxy: ProxyListItem): string {
  return `${proxy.type}-${proxy.host}:${proxy.port}-${proxy.username || ''}`
}

export function duplicateIndexOf (list: ProxyListItem[], proxy: ProxyListItem): number | undefined {
  const signature = proxySignature(proxy)
  const index = list.findIndex(entry => entry !== null && proxySignature(entry) === signature)
  return index === -1 ? undefined : index
}

export function applyImportedProxy (list: ProxyListItem[], decision: ImportedProxyDecision): ProxyListItem[] {
  const { proxy, duplicateIndex, choice, copyId } = decision
  if (duplicateIndex === undefined) return [...list, proxy]
  if (choice === 'replace') {
    const target = list[duplicateIndex]
    return list.map((entry, position) => position === duplicateIndex ? { ...proxy, id: target.id } : entry)
  }
  if (choice === 'keepBoth') return [...list, proxyCopy(proxy, copyId)]
  return list
}

function proxyCopy (proxy: ProxyListItem, copyId: string): ProxyListItem {
  return proxy.label ? { ...proxy, id: copyId, label: `${proxy.label} (copy)` } : { ...proxy, id: copyId }
}
