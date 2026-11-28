import { buttonGroup } from '../components/button'
import { element, type Child } from '../dom'

export type LogToolbarParts = {
  actions: Child[];
  autoRefresh: Child;
  createRule: Child;
  selectionHint: Child;
}

export function logToolbar (parts: LogToolbarParts): HTMLElement {
  return element('div', { class: 'log-toolbar' },
    element('div', { class: 'log-toolbar__row' }, buttonGroup(...parts.actions), parts.autoRefresh),
    element('div', { class: 'log-toolbar__row' }, parts.createRule, parts.selectionHint),
  )
}
