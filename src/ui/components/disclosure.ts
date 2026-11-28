import { element, type Child } from '../dom'
import { icon } from '../icons'

export function disclosure (name: string, state: Child, open: boolean, ...children: Child[]): HTMLDetailsElement {
  return element('details', { class: 'disclosure', open },
    element('summary', { class: 'disclosure__summary' },
      element('span', { class: 'disclosure__chevron', 'aria-hidden': 'true' }, icon('chevron-right')),
      element('span', { class: 'disclosure__name' }, name),
      element('span', { class: 'disclosure__state' }, state),
    ),
    element('div', { class: 'disclosure__body' }, ...children),
  )
}
