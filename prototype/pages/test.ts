import { element, replaceContent } from '@ui/dom'
import { button } from '@ui/components/button'
import { passwordField, selectField, textField } from '@ui/components/fields'
import { statusLine } from '@ui/components/feedback'
import { isNotInControl } from '../components/not-routing'
import { asProxyType, proxyTypeSegmented } from '../components/proxy-type'
import { draftValue, readDraft } from '@ui/components/sheet'
import { stateBody } from '@ui/components/state-body'
import { defaults, proxies } from '../sample-data'
import { isUsable, proxyAddress } from '../proxy-lookup'
import type { ProxyEntry } from '../model'
import { openProxySheet } from '../sheets/proxy-sheet'
import type { SectionContext } from './section-context'

const TEST_DELAY_MS = 600
const TIMEOUT_NOTE = 'A test gives up after 5 seconds, or 30 seconds for an HTTP proxy with a username.'
const CHROME_BLOCKED_NOTE = 'Tests cannot run while GeoBypass does not control proxy settings.'

type TestTarget = {
  host: string;
  port: string;
}

type TestResult =
  | { kind: 'idle' }
  | { kind: 'blocked' }
  | { kind: 'busy' }
  | { kind: 'connected'; address: string }
  | { kind: 'failed'; reason: string }

export function testSection (context: SectionContext): HTMLElement {
  const { browser, proxyControl } = context.store.get()
  const blocked = isNotInControl(browser, proxyControl)
  const resultSlot = element('div', { class: 'stack', role: 'status', 'aria-live': 'polite' })
  showResult(resultSlot, blocked ? { kind: 'blocked' } : { kind: 'idle' })
  return element('section', { class: 'stack' },
    element('header', { class: 'list-section__header' },
      element('div', { class: 'list-section__header-text' },
        element('h2', { class: 'page-title' }, 'Test'),
        element('p', { class: 'help' }, 'Check that a proxy connects and see the reason when it does not.'),
      ),
    ),
    element('section', { class: 'card stack' },
      textField({ name: 'testUrl', label: 'Test URL', type: 'url', value: defaults.testUrl, help: 'Starts as the test URL from Defaults.' }),
    ),
    savedProxyCard(resultSlot, context, blocked),
    customProxyCard(resultSlot, context, blocked),
    resultSlot,
    element('p', { class: 'help' }, TIMEOUT_NOTE),
  )
}

function showResult (slot: HTMLElement, result: TestResult): void {
  replaceContent(slot, [resultNode(result)])
}

function resultNode (result: TestResult): HTMLElement {
  if (result.kind === 'blocked') return statusLine(CHROME_BLOCKED_NOTE)
  if (result.kind === 'busy') return statusLine('Testing…')
  if (result.kind === 'connected') return statusLine(`Connected through ${result.address}`)
  if (result.kind === 'failed') return statusLine(`Failed: ${result.reason}`, 'danger')
  return statusLine('No test run yet')
}

function runTest (slot: HTMLElement, target: TestTarget): void {
  showResult(slot, { kind: 'busy' })
  window.setTimeout(() => showResult(slot, checkTarget(target)), TEST_DELAY_MS)
}

function checkTarget (target: TestTarget): TestResult {
  if (target.host === '' || /\s/.test(target.host)) return { kind: 'failed', reason: 'Host is not valid.' }
  const port = Number(target.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { kind: 'failed', reason: 'Port is not valid.' }
  return { kind: 'connected', address: `${target.host}:${target.port}` }
}

function savedProxyCard (slot: HTMLElement, context: SectionContext, blocked: boolean): HTMLElement {
  return element('section', { class: 'card stack' },
    element('h3', { class: 'group-label' }, 'Saved proxy'),
    stateBody(context.store.get().listState, {
      emptyTitle: 'No saved proxies yet.',
      emptyText: 'Add one in Proxies, or test a custom proxy below.',
      errorTitle: 'Could not read saved proxies.',
    }, () => [savedProxyControls(slot, context, blocked)]),
  )
}

function savedProxyControls (slot: HTMLElement, context: SectionContext, blocked: boolean): HTMLElement {
  const usable = proxies.filter(entry => isUsable(entry.id) && entry.faults.length === 0)
  const select = selectField({
    name: 'savedProxy',
    label: 'Saved proxy',
    selected: usable[0]?.id ?? '',
    options: usable.map(entry => ({ value: entry.id, label: entry.label || proxyAddress(entry) })),
  })
  const selectedEntry = (): ProxyEntry | undefined => proxies.find(entry => entry.id === select.querySelector('select')?.value)
  return element('div', { class: 'stack' },
    select,
    element('div', { class: 'button-row' },
      button('Test', {
        disabled: blocked,
        onClick: () => {
          const entry = selectedEntry()
          if (entry) runTest(slot, { host: entry.host, port: entry.port })
        },
      }),
      button('Edit', {
        onClick: () => {
          const entry = selectedEntry()
          if (entry) openProxySheet(entry, context)
        },
      }),
    ),
  )
}

function customProxyCard (slot: HTMLElement, context: SectionContext, blocked: boolean): HTMLElement {
  const buttons = element('div', { class: 'button-row' })
  const form = element('form', { class: 'card stack', novalidate: true },
    element('h3', { class: 'group-label' }, 'Custom proxy'),
    proxyTypeSegmented('customType', 'http'),
    element('div', { class: 'field-pair' },
      textField({ name: 'customHost', label: 'Host', value: '', mono: true }),
      textField({ name: 'customPort', label: 'Port', value: '', mono: true, inputMode: 'numeric' }),
    ),
    textField({ name: 'customUsername', label: 'Username', value: '', mono: true }),
    passwordField({ name: 'customPassword', label: 'Password', value: '' }),
    buttons,
  )
  form.addEventListener('submit', event => event.preventDefault())
  buttons.append(
    button('Test', {
      disabled: blocked,
      onClick: () => {
        const draft = readDraft(form)
        runTest(slot, { host: draftValue(draft, 'customHost'), port: draftValue(draft, 'customPort') })
      },
    }),
    button('Add to list', {
      onClick: () => {
        const draft = readDraft(form)
        openProxySheet(null, context, {
          type: asProxyType(draftValue(draft, 'customType')),
          host: draftValue(draft, 'customHost'),
          port: draftValue(draft, 'customPort'),
          username: draftValue(draft, 'customUsername'),
          password: draftValue(draft, 'customPassword'),
        })
      },
    }),
  )
  return form
}
