import { mountBar } from './browser-bar'
import { requireElement } from '@ui/dom'
import { installSprite } from '@ui/icons'
import { mountPopup } from './popup'
import { mountDashboard } from './pages/dashboard'
import type { PrototypeState } from './model'
import { createStore, type Store } from './store'

type PageMount = (root: HTMLElement, store: Store<PrototypeState>) => void

const PAGES: Record<string, PageMount | undefined> = {
  dashboard: mountDashboard,
  popup: mountPopup,
}

function applyToDocument (state: PrototypeState): void {
  document.documentElement.dataset.browser = state.browser
  if (state.theme === 'system') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = state.theme
  }
}

function start (): void {
  const page = PAGES[document.body.dataset.page ?? '']
  if (!page) throw new Error('Unknown prototype page')
  const store = createStore<PrototypeState>({ browser: 'firefox', listState: 'populated', theme: 'system', proxyControl: 'geobypass', saveFailed: false })
  installSprite()
  applyToDocument(store.get())
  store.subscribe(applyToDocument)
  mountBar(requireElement('prototype-bar'), store)
  page(requireElement('app'), store)
}

start()
