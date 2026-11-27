import { element } from '@ui/dom'
import { segmented, type SegmentOption } from '@ui/components/controls'
import type { Browser, ListState, PrototypeState, ProxyControl, ThemeChoice } from './model'
import type { Store } from './store'

const BROWSER_OPTIONS: SegmentOption<Browser>[] = [
  { value: 'firefox', label: 'Firefox' },
  { value: 'chrome', label: 'Chrome' },
]

const LIST_STATE_OPTIONS: SegmentOption<ListState>[] = [
  { value: 'populated', label: 'Populated' },
  { value: 'empty', label: 'Empty' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
]

const PROXY_CONTROL_OPTIONS: SegmentOption<ProxyControl>[] = [
  { value: 'geobypass', label: 'GeoBypass' },
  { value: 'other-extension', label: 'Other extension' },
  { value: 'policy', label: 'Policy' },
]

type SaveResult = 'saved' | 'failed'

const SAVE_OPTIONS: SegmentOption<SaveResult>[] = [
  { value: 'saved', label: 'Saves' },
  { value: 'failed', label: 'Fails' },
]

const THEME_OPTIONS: SegmentOption<ThemeChoice>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function mountBar (root: HTMLElement, store: Store<PrototypeState>): void {
  const current = store.get()
  root.replaceChildren(
    element('section', { class: 'prototype-bar', 'aria-label': 'Prototype controls' },
      element('p', { class: 'prototype-bar__note' }, 'Prototype controls. Not part of the product.'),
      segmented('Browser', 'bar-browser', BROWSER_OPTIONS, current.browser, browser => store.update({ browser })),
      segmented('List state', 'bar-list-state', LIST_STATE_OPTIONS, current.listState, listState => store.update({ listState })),
      segmented('Proxy control', 'bar-proxy-control', PROXY_CONTROL_OPTIONS, current.proxyControl, proxyControl => store.update({ proxyControl })),
      segmented('Save result', 'bar-save', SAVE_OPTIONS, current.saveFailed ? 'failed' : 'saved', result => store.update({ saveFailed: result === 'failed' })),
      segmented('Theme', 'bar-theme', THEME_OPTIONS, current.theme, theme => store.update({ theme })),
    ),
  )
}
