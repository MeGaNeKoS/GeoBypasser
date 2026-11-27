import { element, replaceContent } from './dom'
import { iconButton } from './components/button'
import { skeletonRows, statusLine } from './components/feedback'
import { switchControl } from './components/controls'
import { SAVE_FAILED_TEXT } from './components/save-failure'
import { popupNotRouting, ROUTING_AGAIN_TEXT, routingRestored } from './components/not-routing'
import { popupThisTab } from './popup-this-tab'
import { popupRules, type Rerender } from './popup-rules'
import type { Browser, PrototypeState } from './model'
import type { Store } from './store'

export function mountPopup (root: HTMLElement, store: Store<PrototypeState>): void {
  let previousControl = store.get().proxyControl
  let restored = false
  const render = (focusKey?: string): void => {
    replaceContent(root, popupNodes(store.get(), restored, render), focusKey)
  }
  render()
  store.subscribe(() => {
    const { browser, proxyControl } = store.get()
    restored = routingRestored(browser, previousControl, proxyControl)
    previousControl = proxyControl
    render()
  })
}

function popupNodes (state: PrototypeState, restored: boolean, rerender: Rerender): Node[] {
  const notRouting = popupNotRouting(state.browser, state.proxyControl)
  return [
    popupHeader(),
    ...(state.saveFailed ? [statusLine(SAVE_FAILED_TEXT, 'danger')] : []),
    ...(notRouting ? [notRouting] : []),
    ...(restored ? [statusLine(ROUTING_AGAIN_TEXT)] : []),
    ...popupBody(state, rerender),
  ]
}

function popupHeader (): HTMLElement {
  return element('header', { class: 'popup__header' },
    element('span', { class: 'popup__brand' }, 'GeoBypass'),
    element('a', { class: 'button button--quiet', href: 'index.html' }, 'Dashboard'),
    iconButton('close', 'Close', () => window.close()),
  )
}

function popupBody (state: PrototypeState, rerender: Rerender): Node[] {
  if (state.listState === 'loading') return [skeletonRows(4)]
  if (state.listState === 'error') return [statusLine('Could not read this tab.', 'danger')]
  return [
    popupThisTab(state.browser, state.proxyControl),
    monitorRow(state.browser),
    popupRules(state.listState, rerender),
  ]
}

function monitorRow (browser: Browser): HTMLElement {
  return element('section', { class: 'popup__block popup__monitor' },
    element('div', { class: 'popup__monitor-row' },
      element('span', { class: 'field__label' }, 'Monitor this tab'),
      switchControl('Monitor this tab', false, undefined, { field: 'monitor' }),
    ),
    browser === 'chrome' ? element('p', { class: 'help' }, 'Keep DevTools open while monitoring.') : null,
  )
}
