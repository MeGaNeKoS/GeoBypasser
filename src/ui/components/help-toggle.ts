import { element } from '../dom'

export function helpToggle (label: string, text: string): HTMLDetailsElement {
  return element('details', { class: 'help-toggle' },
    element('summary', { class: 'link-button' }, label),
    element('p', { class: 'help' }, text),
  )
}
