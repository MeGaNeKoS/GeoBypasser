import { element } from '../dom'
import { switchControl } from '../components/controls'
import { disclosure } from '../components/disclosure'
import { textField, passwordField } from '../components/fields'
import { badge } from '../components/feedback'
import { asProxyType, proxyTypeSegmented } from '../components/proxy-type'
import { draftFlag, draftOf, draftValue, faultFor, faultsOnOpen, openSheet, type Draft, type Fault } from '../components/sheet'
import { newId, upsert } from '../collections'
import type { SectionContext } from '../pages/section-context'
import type { Browser, ProxyEntry, ProxyType } from '../model'
import { proxies } from '../sample-data'

export type ProxySeed = {
  type: ProxyType;
  host: string;
  port: string;
  username?: string;
  password?: string;
}

const NOTIFY_HELP = 'Needs a keep-alive rule for this proxy. You are told after 3 failed checks in a row, and again when it responds.'
const DNS_SOCKS_HELP = 'Site names are looked up by the proxy, not by this device.'
const FAILOVER_HELP = 'How long to wait on this proxy before treating it as failed. Leave empty for the default: 3 seconds, or 30 for an HTTP proxy with a username.'
const FAILOVER_ERROR = 'Enter a whole number of seconds, 1 or more, or leave empty.'

export function openProxySheet (entry: ProxyEntry | null, context: SectionContext, seed?: ProxySeed): void {
  const browser = context.store.get().browser
  const draft = proxyDraft(entry, seed)
  openSheet({
    title: entry ? 'Edit proxy' : 'Add proxy',
    saveLabel: 'Save proxy',
    draft,
    initialFaults: faultsOnOpen(entry?.faults ?? [], draft, validateProxy),
    render: (current, faults) => proxyBody(current, faults, browser),
    validate: validateProxy,
    save: current => saveProxy(entry, current, context),
  })
}

function proxyDraft (entry: ProxyEntry | null, seed: ProxySeed | undefined): Draft {
  return draftOf({
    label: entry?.label ?? '',
    type: entry?.type ?? seed?.type ?? 'http',
    host: entry?.host ?? seed?.host ?? '',
    port: entry?.port ?? seed?.port ?? '',
    username: entry?.username ?? seed?.username ?? '',
    password: entry?.password ?? seed?.password ?? '',
    notify: entry?.notify ?? false,
    resolveDnsThroughProxy: entry?.resolveDnsThroughProxy ?? true,
    failoverTimeout: entry?.failoverTimeout ?? '',
  })
}

function proxyBody (draft: Draft, faults: Fault[], browser: Browser): Node[] {
  return [
    textField({ name: 'label', label: 'Label', value: draftValue(draft, 'label') }),
    proxyTypeSegmented('type', draftValue(draft, 'type')),
    element('div', { class: 'field-pair' },
      textField({ name: 'host', label: 'Host', value: draftValue(draft, 'host'), mono: true, fault: faultFor(faults, 'host') }),
      textField({ name: 'port', label: 'Port', value: draftValue(draft, 'port'), mono: true, inputMode: 'numeric', fault: faultFor(faults, 'port') }),
    ),
    textField({ name: 'username', label: 'Username', value: draftValue(draft, 'username'), mono: true }),
    passwordField({ name: 'password', label: 'Password', value: draftValue(draft, 'password') }),
    notifyField(draft, browser),
    advancedGroup(draft, faults, browser),
  ]
}

function notifyField (draft: Draft, browser: Browser): HTMLDivElement {
  return element('div', { class: 'field' },
    element('div', { class: 'field__row' },
      element('span', { class: 'field__label' }, 'Notify if down'),
      switchControl('Notify if down', draftFlag(draft, 'notify'), undefined, { field: 'notify' }),
    ),
    element('p', { class: 'help' }, browser === 'chrome' ? badge('firefox') : null, NOTIFY_HELP),
  )
}

function advancedGroup (draft: Draft, faults: Fault[], browser: Browser): HTMLDetailsElement {
  const failoverFault = faultFor(faults, 'failoverTimeout')
  return disclosure('Advanced', advancedState(draft, browser), changedAdvancedCount(draft) > 0 || failoverFault !== undefined,
    browser === 'chrome' ? element('p', { class: 'help' }, 'Chrome ignores both settings. They are saved and take effect in Firefox.') : null,
    dnsSetting(draft),
    textField({
      name: 'failoverTimeout',
      label: 'Failover timeout',
      type: 'number',
      inputMode: 'numeric',
      value: draftValue(draft, 'failoverTimeout'),
      placeholder: 'Default',
      suffix: 'seconds',
      help: FAILOVER_HELP,
      fault: failoverFault,
    }),
  )
}

function advancedState (draft: Draft, browser: Browser): Node {
  const changed = changedAdvancedCount(draft)
  return element('span', {}, browser === 'chrome' ? badge('firefox') : null, changed === 0 ? 'Defaults in use' : `${changed} changed`)
}

function changedAdvancedCount (draft: Draft): number {
  const dnsChanged = draftFlag(draft, 'resolveDnsThroughProxy') ? 0 : 1
  const failoverChanged = draftValue(draft, 'failoverTimeout') === '' ? 0 : 1
  return dnsChanged + failoverChanged
}

function dnsSetting (draft: Draft): HTMLDivElement {
  return element('div', { class: 'field' },
    element('div', { class: 'field__row' },
      element('span', { class: 'field__label' }, 'Resolve DNS through the proxy'),
      element('span', { 'data-show-when': 'type=socks5' },
        switchControl('Resolve DNS through the proxy', draftFlag(draft, 'resolveDnsThroughProxy'), undefined, { field: 'resolveDnsThroughProxy' }),
      ),
      element('span', { class: 'field__locked', 'data-show-when': 'type=http' }, 'Always on the proxy side for HTTP proxies'),
    ),
    element('p', { class: 'help', 'data-show-when': 'type=socks5' }, DNS_SOCKS_HELP),
  )
}

function validateProxy (draft: Draft): Fault[] {
  const faults: Fault[] = []
  const host = draftValue(draft, 'host').trim()
  if (host === '' || /\s/.test(host)) {
    faults.push({ field: 'host', message: 'Host must be a host name or IP address with no spaces.' })
  }
  const port = Number(draftValue(draft, 'port'))
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    faults.push({ field: 'port', message: 'Port must be a number from 1 to 65535.' })
  }
  if (!isFailoverValid(draftValue(draft, 'failoverTimeout'))) {
    faults.push({ field: 'failoverTimeout', message: FAILOVER_ERROR })
  }
  return faults
}

function isFailoverValid (value: string): boolean {
  return value === '' || /^[1-9]\d*$/.test(value)
}

function saveProxy (entry: ProxyEntry | null, draft: Draft, context: SectionContext): void {
  upsert(proxies, {
    id: entry?.id ?? newId('proxy'),
    label: draftValue(draft, 'label').trim(),
    type: asProxyType(draftValue(draft, 'type')),
    host: draftValue(draft, 'host').trim(),
    port: draftValue(draft, 'port'),
    username: draftValue(draft, 'username'),
    password: draftValue(draft, 'password'),
    notify: draftFlag(draft, 'notify'),
    resolveDnsThroughProxy: draftFlag(draft, 'resolveDnsThroughProxy'),
    failoverTimeout: draftValue(draft, 'failoverTimeout'),
    faults: [],
    notices: [],
  })
  context.refresh('Saved')
}
