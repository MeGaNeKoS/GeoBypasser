import { element, replaceContent } from './dom'
import { icon } from './icons'
import { statusLine } from './components/feedback'
import type { ListState, PrototypeState } from './model'
import type { Store } from './store'

const MONITORING_TEXT = 'Network monitoring is on for this tab while DevTools is open. See usage in the dashboard under Network.'
const CONNECTING_TEXT = 'Connecting to the extension…'
const DISCONNECTED_TEXT = 'Not connected to the extension. Close and reopen DevTools.'

export function mountDevtools (root: HTMLElement, store: Store<PrototypeState>): void {
  const render = (): void => replaceContent(root, [devtoolsLine(store.get().listState)])
  render()
  store.subscribe(render)
}

function devtoolsLine (listState: ListState): HTMLElement {
  return element('div', { class: 'devtools__line' }, ...statusNodes(listState))
}

function statusNodes (listState: ListState): Node[] {
  if (listState === 'loading') return [statusLine(CONNECTING_TEXT)]
  if (listState === 'error') return [statusLine(DISCONNECTED_TEXT, 'danger')]
  return [icon('check'), statusLine(MONITORING_TEXT)]
}
