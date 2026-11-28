import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import { element } from '../dom'

export function typeGrid (name: string, legend: string, selected: string[]): HTMLFieldSetElement {
  return element('fieldset', { class: 'type-grid' },
    element('legend', { class: 'field__label' }, legend),
    element('div', { class: 'type-grid__options' },
      ...WEB_REQUEST_RESOURCE_TYPES.map(type => element('label', { class: 'checkbox' },
        element('input', { type: 'checkbox', name, value: type, checked: selected.includes(type) }),
        type,
      )),
    ),
  )
}
