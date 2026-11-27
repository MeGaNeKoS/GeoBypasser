import { element, type Child } from '../dom'

export function disclosure (name: string, state: Child, open: boolean, ...children: Child[]): HTMLDetailsElement {
  return element('details', { class: 'disclosure', open },
    element('summary', { class: 'disclosure__summary' },
      element('span', {}, name),
      element('span', { class: 'disclosure__state' }, state),
    ),
    element('div', { class: 'disclosure__body' }, ...children),
  )
}
