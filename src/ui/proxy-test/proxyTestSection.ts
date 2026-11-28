import type { ProxyType } from '@customTypes/generic'
import type { ProxyListItem } from '@customTypes/proxy'
import { testProxyConfigQueued } from '@utils/proxy'
import { canRunProxyTests } from '@utils/proxyControl'
import { proxyFormFaults, proxyFormOf, proxyFromForm } from '@utils/proxyDraft'
import type { ProxyForm, ProxyFormField, ProxyFormFault } from '@utils/proxyDraft'
import { proxyTestPanelOf } from '@utils/proxyTestOutcome'
import type { ProxyTestOutcome } from '@utils/proxyTestOutcome'
import { getConfig } from '@utils/storage'
import { usableProxies } from '@utils/usable'
import { button, buttonGroup } from '../components/button'
import { segmented } from '../components/controls'
import type { SegmentOption } from '../components/controls'
import { faultLine, faultLineId, passwordField, textField } from '../components/fields'
import { proxySelectField } from '../components/proxy-select'
import { sectionHeading } from '../components/section-heading'
import { testUrlField } from '../components/test-url-field'
import { element, focusedKey, replaceContent, requireElement } from '../dom'
import { icon } from '../icons'
import { openProxyEditor } from '../proxies/proxySheet'
import { readProxyControlState } from '../proxyControlState'
import { BLOCKED_REASON_FOCUS_KEY, testRenderFocus } from './testRenderFocus'

const CONTAINER_ID = 'testContent'
const HEADING = 'Test'
const SAVED_HEADING = 'Saved proxy'
const CUSTOM_HEADING = 'Custom proxy'
const PORT_FIELD_ID = 'test-port'
const NO_SAVED_PROXY = 'No usable proxy to test yet. Add one on Proxies.'
const IDLE_TEXT = 'No test run yet'
const BUSY_TEXT = 'Testing…'
const CONNECTED_PREFIX = 'Connected through '
const FAILED_LABEL = 'Failed:'
const BLOCKED_REASON = 'Tests cannot run while GeoBypass does not control proxy settings.'
const RESULT_LINE_CLASS = 'result-line'
const RESULT_LINE_DANGER_CLASS = 'result-line--danger'
const TIMEOUTS_NOTE ='Tests time out after 5 seconds, or 30 for an HTTP proxy with a username.'
const TYPE_OPTIONS: SegmentOption<ProxyType>[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'socks', label: 'SOCKS5' },
]

let savedProxyId: string | undefined
let customForm: ProxyForm = proxyFormOf()
let customFaultsShown = false
let outcome: ProxyTestOutcome = { state: 'idle' }
let blockedReturnKey: string | undefined

export async function renderProxyTestSection (focusKey?: string): Promise<void> {
  const [config, controlState] = await Promise.all([getConfig(), readProxyControlState()])
  const testable = canRunProxyTests(controlState)
  const focus = testRenderFocus({ focusedKey: focusKey ?? focusedKey(), testable, returnKey: blockedReturnKey })
  blockedReturnKey = focus.returnKey
  replaceContent(requireElement(CONTAINER_ID), proxyTestContent(config.proxyList, config.testProxyUrl, testable), focus.focusKey)
}

function proxyTestContent (proxyList: ProxyListItem[], testUrl: string, testable: boolean): Node[] {
  return [
    element('div', { class: 'stack' },
      sectionHeading(HEADING),
      element('div', { class: 'settings-card' }, testUrlField(testUrl, renderProxyTestSection)),
      savedProxyCard(proxyList, testable),
      customProxyCard(testable),
      resultPanel(testable),
    ),
  ]
}

function savedProxyCard (proxyList: ProxyListItem[], testable: boolean): HTMLElement {
  const proxies = usableProxies(proxyList)
  const chosen = proxies.find(proxy => proxy.id === savedProxyId) ?? proxies[0]
  if (!chosen) {
    return element('div', { class: 'settings-card' },
      element('h3', {}, SAVED_HEADING),
      element('p', { class: 'help' }, NO_SAVED_PROXY),
    )
  }
  return element('div', { class: 'settings-card' },
    element('h3', {}, SAVED_HEADING),
    proxySelectField({
      name: 'savedProxy',
      label: 'Proxy',
      proxyList,
      proxyId: chosen.id,
      fault: undefined,
      choices: { includeDirect: false, excludedProxyIds: [] },
      focusKey: 'saved-proxy',
      onChange: chooseSavedProxy,
    }),
    buttonGroup(
      button('Test', { focusKey: 'test-saved', disabled: !testable, onClick: () => void runTest(chosen, 'test-saved') }),
      button('Edit', {
        focusKey: 'edit-saved',
        onClick: () => openProxyEditor({ entry: { proxy: chosen, position: proxyList.findIndex(proxy => proxy.id === chosen.id) } }),
      }),
    ),
  )
}

function chooseSavedProxy (proxyId: string): void {
  savedProxyId = proxyId
  void renderProxyTestSection('saved-proxy')
}

function customProxyCard (testable: boolean): HTMLElement {
  const faults = customFaultsShown ? proxyFormFaults(customForm) : []
  return element('div', { class: 'settings-card' },
    element('h3', {}, CUSTOM_HEADING),
    segmented('Type', 'testType', TYPE_OPTIONS, customForm.type as ProxyType, type => editCustom({ type })),
    element('div', { class: 'field-pair' },
      textField({
        name: 'testHost', label: 'Host', value: customForm.host, mono: true, focusKey: 'test-host',
        fault: faultOf(faults, 'host'), onInput: host => editCustom({ host }),
      }),
      textField({
        name: 'testPort', id: PORT_FIELD_ID, label: 'Port', type: 'number', inputMode: 'numeric', value: customForm.port, mono: true,
        fault: faultOf(faults, 'port'), faultPlacement: 'elsewhere', focusKey: 'test-port', onInput: port => editCustom({ port }),
      }),
    ),
    portFault(faults),
    textField({
      name: 'testUsername', label: 'Username', value: customForm.username, autocomplete: 'off', focusKey: 'test-username',
      onInput: username => editCustom({ username }),
    }),
    passwordField({
      name: 'testPassword', label: 'Password', value: customForm.password, focusKey: 'test-password',
      onInput: password => editCustom({ password }),
    }),
    buttonGroup(
      button('Test', { focusKey: 'test-custom', disabled: !testable, onClick: testCustomProxy }),
      button('Add to list', { focusKey: 'add-custom', onClick: addCustomToList }),
    ),
  )
}

function portFault (faults: ProxyFormFault[]): HTMLParagraphElement | null {
  const message = faultOf(faults, 'port')
  return message === undefined ? null : faultLine(message, faultLineId(PORT_FIELD_ID))
}

function faultOf (faults: ProxyFormFault[], field: ProxyFormField): string | undefined {
  return faults.find(fault => fault.field === field)?.message
}

function editCustom (change: Partial<ProxyForm>): void {
  customForm = { ...customForm, ...change }
}

function customFormIsValid (): boolean {
  return proxyFormFaults(customForm).length === 0
}

function showCustomFaults (focusKey: string): void {
  customFaultsShown = true
  void renderProxyTestSection(focusKey)
}

function testCustomProxy (): void {
  if (!customFormIsValid()) {
    outcome = { state: 'idle' }
    showCustomFaults('test-custom')
    return
  }
  customFaultsShown = false
  void runTest(proxyFromForm(customForm, crypto.randomUUID()), 'test-custom')
}

function addCustomToList (): void {
  if (!customFormIsValid()) {
    showCustomFaults('add-custom')
    return
  }
  customFaultsShown = false
  openProxyEditor({ prefill: proxyFromForm(customForm, crypto.randomUUID()) })
}

async function runTest (proxy: ProxyListItem, focusKey: string): Promise<void> {
  const config = await getConfig()
  outcome = { state: 'busy' }
  void renderProxyTestSection(focusKey)
  await testProxyConfigQueued(proxy, config.testProxyUrl, result => {
    outcome = { state: 'finished', result }
    void renderProxyTestSection(focusKey)
  })
}

function resultPanel (testable: boolean): HTMLElement {
  return element('div', { class: 'settings-card' },
    testable ? outcomeLine(outcome) : blockedLine(),
    element('p', { class: 'help' }, TIMEOUTS_NOTE),
  )
}

function outcomeLine (current: ProxyTestOutcome): HTMLParagraphElement {
  const panel = proxyTestPanelOf(current)
  if (panel.kind === 'connected') {
    return element('p', { role: 'status', class: RESULT_LINE_CLASS }, icon('check'), CONNECTED_PREFIX, element('span', { class: 'mono' }, panel.proxy))
  }
  if (panel.kind === 'failed') {
    return element('p', { role: 'status', class: `${RESULT_LINE_CLASS} ${RESULT_LINE_DANGER_CLASS}` }, icon('alert'), element('span', { class: 'result-label--danger' }, FAILED_LABEL), ` ${panel.reason}`)
  }
  return element('p', { role: 'status' }, panel.kind === 'busy' ? BUSY_TEXT : IDLE_TEXT)
}

function blockedLine (): HTMLParagraphElement {
  return element('p', { role: 'status', class: RESULT_LINE_CLASS, tabindex: '-1', 'data-focus-key': BLOCKED_REASON_FOCUS_KEY }, icon('alert'), BLOCKED_REASON)
}
