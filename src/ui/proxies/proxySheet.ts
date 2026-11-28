import type { ProxyListItem } from '@customTypes/proxy'
import type { ProxyType } from '@customTypes/generic'
import { supportsProxyOnRequest } from '@utils/env'
import { proxyFormFaults, proxyFormOf, proxyFromForm, proxyListReplacingAt, proxyListWith } from '@utils/proxyDraft'
import type { ProxyForm } from '@utils/proxyDraft'
import { segmented, switchControl } from '../components/controls'
import type { SegmentOption } from '../components/controls'
import { badge } from '../components/feedback'
import { disclosure } from '../components/disclosure'
import { passwordField, switchField, textField } from '../components/fields'
import { draftFlag, draftOf, draftValue, faultFor, openSheet } from '../components/sheet'
import type { Draft, Fault } from '../components/sheet'
import { element } from '../dom'
import type { Child } from '../dom'
import { changeProxyList } from './proxyStore'

export type ProxyEditorOptions = {
  entry?: { proxy?: ProxyListItem; position: number; needsReview?: boolean };
  prefill?: ProxyListItem;
  onSaved?: () => void;
}

const TYPE_OPTIONS: SegmentOption<ProxyType>[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'socks', label: 'SOCKS5' },
]
const NOTIFY_HELP = 'Needs a keep-alive rule for this proxy. You are told after 3 failed checks in a row, and again when it responds.'
const DNS_LABEL = 'Resolve DNS through the proxy'
const DNS_HELP = 'Site names are looked up by the proxy, not by this device.'
const DNS_LOCKED_TEXT = 'Always on the proxy side for HTTP proxies.'
const FAILOVER_HELP = 'How long to wait on this proxy before treating it as failed. Leave empty for the default: 3 seconds, or 30 for an HTTP proxy with a username.'
const FAILOVER_UNITS = 'seconds'
const FIREFOX_ONLY_NOTE = 'Chrome ignores both settings. They are saved and take effect in Firefox.'

export function openProxyEditor (options: ProxyEditorOptions): void {
  const form = proxyFormOf(options.entry?.proxy ?? options.prefill)
  openSheet({
    title: options.entry ? 'Edit proxy' : 'Add proxy',
    saveLabel: 'Save',
    draft: draftOf({ ...form }),
    initialFaults: options.entry?.needsReview ? proxyFormFaults(form) : undefined,
    render: (draft, faults) => renderFields(formFromDraft(draft), faults),
    validate: draft => proxyFormFaults(formFromDraft(draft)),
    save: draft => {
      const saved = proxyFromForm(formFromDraft(draft), savedIdOf(options))
      void changeProxyList(list => listWithSaved(list, saved, options.entry?.position)).then(() => options.onSaved?.())
    },
  })
}

function savedIdOf (options: ProxyEditorOptions): string {
  return options.entry?.proxy?.id || crypto.randomUUID()
}

function listWithSaved (list: ProxyListItem[], saved: ProxyListItem, position: number | undefined): ProxyListItem[] {
  return position === undefined ? proxyListWith(list, saved) : proxyListReplacingAt(list, position, saved)
}

function formFromDraft (draft: Draft): ProxyForm {
  return {
    label: draftValue(draft, 'label'),
    type: draftValue(draft, 'type'),
    host: draftValue(draft, 'host'),
    port: draftValue(draft, 'port'),
    username: draftValue(draft, 'username'),
    password: draftValue(draft, 'password'),
    notifyIfDown: draftFlag(draft, 'notifyIfDown'),
    proxyDNS: draftFlag(draft, 'proxyDNS'),
    failoverTimeout: draftValue(draft, 'failoverTimeout'),
  }
}

function renderFields (form: ProxyForm, faults: Fault[]): Node[] {
  return [
    textField({ name: 'label', label: 'Label', value: form.label, fault: faultFor(faults, 'label') }),
    typeField(form, faults),
    element('div', { class: 'field-pair' },
      textField({ name: 'host', label: 'Host', value: form.host, mono: true, fault: faultFor(faults, 'host') }),
      textField({
        name: 'port', label: 'Port', type: 'number', inputMode: 'numeric', value: form.port, mono: true,
        fault: faultFor(faults, 'port'),
      }),
    ),
    textField({ name: 'username', label: 'Username', value: form.username, autocomplete: 'off', fault: faultFor(faults, 'username') }),
    passwordField({ name: 'password', label: 'Password', value: form.password, fault: faultFor(faults, 'password') }),
    notifyField(form),
    advancedGroup(form, faults),
  ]
}

function typeField (form: ProxyForm, faults: Fault[]): HTMLElement {
  const fault = faultFor(faults, 'type')
  return element('div', { class: fault ? 'field field--invalid' : 'field' },
    segmented('Type', 'type', TYPE_OPTIONS, form.type as ProxyType),
    fault ? element('p', { class: 'field__error' }, fault) : null,
  )
}

function notifyField (form: ProxyForm): HTMLElement {
  return switchField({
    label: 'Notify if down',
    control: switchControl('Notify if down', form.notifyIfDown, undefined, { field: 'notifyIfDown' }),
    badge: supportsProxyOnRequest ? undefined : badge('firefox'),
    help: NOTIFY_HELP,
  })
}

function advancedGroup (form: ProxyForm, faults: Fault[]): HTMLDetailsElement {
  const changes = changedCount(form)
  const failoverFault = faultFor(faults, 'failoverTimeout')
  return disclosure('Advanced', changes === 0 ? 'Defaults in use' : `${changes} changed`, changes > 0 || failoverFault !== undefined,
    ...advancedNotes(),
    ...dnsFields(form),
    failoverField(form, failoverFault),
  )
}

function advancedNotes (): Child[] {
  if (supportsProxyOnRequest) return []
  return [element('p', { class: 'help' }, badge('firefox'), ' ', FIREFOX_ONLY_NOTE)]
}

function changedCount (form: ProxyForm): number {
  const dnsChanged = form.type === 'socks' && !form.proxyDNS
  const failoverChanged = form.failoverTimeout.trim() !== ''
  return Number(dnsChanged) + Number(failoverChanged)
}

function dnsFields (form: ProxyForm): HTMLElement[] {
  return [
    switchField({
      label: DNS_LABEL,
      control: switchControl(DNS_LABEL, form.proxyDNS, undefined, { field: 'proxyDNS' }),
      help: DNS_HELP,
      showWhen: 'type=socks',
    }),
    switchField({ label: DNS_LABEL, control: element('span', {}, DNS_LOCKED_TEXT), showWhen: 'type=http' }),
  ]
}

function failoverField (form: ProxyForm, fault: string | undefined): HTMLDivElement {
  return textField({
    name: 'failoverTimeout', label: 'Failover timeout', type: 'number', inputMode: 'numeric', value: form.failoverTimeout,
    suffix: FAILOVER_UNITS, placeholder: 'Default', help: FAILOVER_HELP, fault,
  })
}
