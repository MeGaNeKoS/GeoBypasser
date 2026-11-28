import { DIRECT_PROXY_ID } from '@constant/proxy'
import { proxyOptions } from '@utils/pageView'
import { requestProxyTest } from '@utils/proxyTestRequest'
import { canTestProxyId, planClearProxy, planSetProxy } from '@utils/popupPlan'
import type { PopupTarget, ProxyChange } from '@utils/popupPlan'
import { canTestFromPopup, chromeSiteNote, defaultPopupScope, popupScopeOptions, popupTestResultLine, popupUsingLine } from '@utils/popupView'
import type { PopupScope } from '@utils/popupView'
import { getConfig, getTabProxyMap } from '@utils/storage'
import { overrideForHost } from '@utils/usable'
import { button } from '../components/button'
import { segmented } from '../components/controls'
import type { SegmentOption } from '../components/controls'
import { statusLine } from '../components/feedback'
import { selectField } from '../components/fields'
import type { SelectOption } from '../components/fields'
import { element, replaceContent } from '../dom'
import { readProxyControlState } from '../proxyControlState'
import { hashForSection, TEST_SECTION_ID } from '../shell/routes'
import { notInEffectStateOf } from './popupControl'
import { applyProxyChange, openDashboardAt } from './popupEffects'
import type { PopupContext } from './popupContext'

const PROXY_SELECT_ID = 'proxySelect'
const TESTING_TEXT = 'Testing...'
const TEST_FAILED_TEXT = 'Test did not finish.'

type ThisTabView = {
  scope: PopupScope
  chosenProxyId: string | undefined
  testOutput: string | undefined
}

type ThisTabSnapshot = {
  proxyList: unknown
  defaultProxy: string | undefined
  tabProxyId: string | undefined
  siteProxyId: string | undefined
  notInEffect: boolean
}

export type ThisTabMount = { refresh: () => Promise<void> }

export function mountThisTab (slot: HTMLElement, context: PopupContext): ThisTabMount {
  const view: ThisTabView = {
    scope: defaultPopupScope(context.supportsPerTabProxy),
    chosenProxyId: undefined,
    testOutput: undefined,
  }
  const refresh = async (): Promise<void> => {
    const snapshot = await readThisTabSnapshot(context)
    replaceContent(slot, thisTabNodes(context, view, snapshot, refresh))
  }
  void refresh()
  return { refresh }
}

async function readThisTabSnapshot (context: PopupContext): Promise<ThisTabSnapshot> {
  const config = await getConfig()
  const tabProxyMap = await getTabProxyMap()
  const control = await readProxyControlState()
  return {
    proxyList: config.proxyList,
    defaultProxy: config.defaultProxy,
    tabProxyId: context.tabId === undefined ? undefined : tabProxyMap[context.tabId],
    siteProxyId: context.host === undefined ? undefined : overrideForHost(config.perWebsiteOverride, context.host),
    notInEffect: notInEffectStateOf(control) !== undefined,
  }
}

function thisTabNodes (context: PopupContext, view: ThisTabView, snapshot: ThisTabSnapshot, refresh: () => Promise<void>): Node[] {
  const fallbackProxyId = snapshot.tabProxyId ?? snapshot.siteProxyId ?? snapshot.defaultProxy ?? DIRECT_PROXY_ID
  const selectedProxyId = (): string => view.chosenProxyId ?? fallbackProxyId
  const targetNow = (): PopupTarget => ({ scope: view.scope, tabId: context.tabId, host: context.host })
  const nodes: Node[] = [
    element('h2', { class: 'popup-heading' }, 'This tab'),
    element('p', { class: 'popup-host' }, context.host ?? 'N/A'),
    element('p', { class: 'popup-using' }, popupUsingLine({
      scope: view.scope,
      tabProxyId: snapshot.tabProxyId,
      siteProxyId: snapshot.siteProxyId,
      proxyList: snapshot.proxyList,
      notInEffect: snapshot.notInEffect,
    })),
    segmented('Apply to', 'scope', scopeChoices(context.supportsPerTabProxy), view.scope, scope => {
      view.scope = scope
      void refresh()
    }),
    selectField({
      id: PROXY_SELECT_ID,
      name: 'proxy',
      label: 'Proxy',
      options: proxyChoices(snapshot.proxyList),
      selected: selectedProxyId(),
      onChange: proxyId => { view.chosenProxyId = proxyId },
    }),
    element('div', { class: 'popup-actions' },
      button('Set', { variant: 'primary', focusKey: 'set-proxy', onClick: () => void applyThenRefresh(view, refresh, planSetProxy(targetNow(), selectedProxyId())) }),
      button('Clear', { focusKey: 'clear-proxy', onClick: () => void applyThenRefresh(view, refresh, planClearProxy(targetNow())) }),
      button('Test proxy', {
        focusKey: 'test-proxy',
        disabled: !canTestFromPopup(context.supportsPerTabProxy) || !canTestProxyId(selectedProxyId()),
        onClick: () => void runProxyTest(view, refresh, selectedProxyId()),
      }),
    ),
  ]
  if (view.testOutput !== undefined) nodes.push(statusLine(view.testOutput))
  if (!context.supportsPerTabProxy) nodes.push(chromeNote(context.host))
  return nodes
}

function scopeChoices (supportsPerTabProxy: boolean): SegmentOption<PopupScope>[] {
  return popupScopeOptions(supportsPerTabProxy).map(option => ({
    value: option.scope,
    label: option.scope === 'tab' ? 'This tab' : 'This site',
    disabled: !option.enabled,
  }))
}

function proxyChoices (proxyList: unknown): SelectOption[] {
  return [
    { value: DIRECT_PROXY_ID, label: 'Direct' },
    ...proxyOptions(proxyList).map(proxy => ({ value: proxy.id, label: proxy.label || `${proxy.host}:${proxy.port}` })),
  ]
}

function chromeNote (host: string | undefined): HTMLDivElement {
  return element('div', { class: 'popup-note', role: 'note' },
    element('p', { class: 'popup-note__title' }, 'On Chrome'),
    element('p', {}, chromeSiteNote(host ?? 'this site')),
    button('Test in dashboard', { variant: 'quiet', onClick: () => void openDashboardAt(`#${hashForSection(TEST_SECTION_ID)}`) }),
  )
}

async function applyThenRefresh (view: ThisTabView, refresh: () => Promise<void>, change: ProxyChange): Promise<void> {
  await applyProxyChange(change)
  view.chosenProxyId = undefined
  await refresh()
}

async function runProxyTest (view: ThisTabView, refresh: () => Promise<void>, proxyId: string): Promise<void> {
  view.testOutput = TESTING_TEXT
  await refresh()
  const result = await requestProxyTest({ proxyId }).catch(() => undefined)
  view.testOutput = result === undefined ? TEST_FAILED_TEXT : popupTestResultLine(result)
  await refresh()
}
