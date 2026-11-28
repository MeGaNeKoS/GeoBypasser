import { supportsProxyOnRequest } from '@utils/env'
import { canSaveDefaultProxy } from '@utils/saveDecisions'
import { getConfig, saveTabProxyMap, updateConfig } from '@utils/storage'
import { button } from '../components/button'
import { switchControl } from '../components/controls'
import { badge } from '../components/feedback'
import { switchField } from '../components/fields'
import { inlineConfirm } from '../components/inline-confirm'
import { otherExtensionsNote } from '../components/other-extensions-note'
import { proxySelectField } from '../components/proxy-select'
import { testUrlField } from '../components/test-url-field'
import { element, replaceContent, requireElement } from '../dom'

const DEFAULTS_CONTAINER_ID = 'defaultsContent'
const HEADING = 'Defaults'
const DEFAULT_PROXY_LABEL = 'Default proxy'
const NONE_LABEL = 'None'
const FALLBACK_LABEL = 'If a proxy fails, connect directly'
const TAB_PROXIES_LABEL = 'Tab proxies'
const CLEAR_TAB_PROXIES_LABEL = 'Clear all tab proxies'
const CLEAR_TAB_PROXIES_QUESTION = 'Clear all tab proxies?'
const CLEAR_TAB_PROXIES_KEY = 'clear-tab-proxies'
const CHROME_TAB_PROXIES_REASON = 'Chrome cannot set a proxy per tab.'

type StoredConfig = Awaited<ReturnType<typeof getConfig>>

let clearTabProxiesPending = false

export async function renderDefaultsSection (focusKey?: string): Promise<void> {
  const config = await getConfig()
  replaceContent(requireElement(DEFAULTS_CONTAINER_ID), defaultsContent(config), focusKey)
}

function defaultsContent (config: StoredConfig): Node[] {
  return [
    element('h2', { class: 'page-title', tabindex: '-1' }, HEADING),
    element('div', { class: 'settings-card' }, ...cardFields(config)),
    ...(supportsProxyOnRequest ? [otherExtensionsNote()] : []),
  ]
}

function cardFields (config: StoredConfig): Node[] {
  return [
    proxySelectField({
      name: 'defaultProxy',
      label: DEFAULT_PROXY_LABEL,
      proxyList: config.proxyList,
      proxyId: config.defaultProxy ?? '',
      fault: undefined,
      choices: { includeDirect: false, excludedProxyIds: [], noneLabel: NONE_LABEL },
      focusKey: 'default-proxy',
      onChange: proxyId => saveDefaultProxy(config, proxyId),
    }),
    switchField({
      label: FALLBACK_LABEL,
      control: switchControl(FALLBACK_LABEL, Boolean(config.fallbackDirect), checked => void updateConfig({ fallbackDirect: checked }), {
        field: 'fallbackDirect',
        focusKey: 'fallback-direct',
      }),
    }),
    testUrlField(config.testProxyUrl, renderDefaultsSection),
    tabProxiesField(),
  ]
}

function saveDefaultProxy (config: StoredConfig, proxyId: string): void {
  if (canSaveDefaultProxy(proxyId, config.proxyList)) void updateConfig({ defaultProxy: proxyId })
}

function tabProxiesField (): HTMLDivElement {
  return element('div', { class: 'field' },
    element('div', { class: 'field__label-row' },
      element('span', { class: 'field__label' }, TAB_PROXIES_LABEL),
      supportsProxyOnRequest ? null : badge('firefox'),
    ),
    clearTabProxiesPending ? clearTabProxiesConfirm() : clearTabProxiesButton(),
    supportsProxyOnRequest ? null : element('p', { class: 'help' }, CHROME_TAB_PROXIES_REASON),
  )
}

function clearTabProxiesButton (): HTMLButtonElement {
  return button(CLEAR_TAB_PROXIES_LABEL, {
    focusKey: CLEAR_TAB_PROXIES_KEY,
    disabled: !supportsProxyOnRequest,
    onClick: askClearTabProxies,
  })
}

function clearTabProxiesConfirm (): HTMLElement {
  return inlineConfirm({
    question: CLEAR_TAB_PROXIES_QUESTION,
    confirmLabel: 'Clear',
    groupLabel: 'Confirm clear tab proxies',
    pendingKey: CLEAR_TAB_PROXIES_KEY,
    onConfirm: confirmClearTabProxies,
    onCancel: cancelClearTabProxies,
  })
}

function askClearTabProxies (): void {
  clearTabProxiesPending = true
  void renderDefaultsSection(`cancel-${CLEAR_TAB_PROXIES_KEY}`)
}

function cancelClearTabProxies (): void {
  clearTabProxiesPending = false
  void renderDefaultsSection(CLEAR_TAB_PROXIES_KEY)
}

function confirmClearTabProxies (): void {
  clearTabProxiesPending = false
  void saveTabProxyMap({})
  void renderDefaultsSection(CLEAR_TAB_PROXIES_KEY)
}
