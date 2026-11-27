import { element } from '../dom'

export const RESOURCE_TYPES = [
  'document',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'imageset',
  'media',
  'font',
  'xmlhttprequest',
  'fetch',
  'beacon',
  'ping',
  'websocket',
  'csp_report',
  'object',
  'object_subrequest',
  'speculative',
  'web_manifest',
  'texttrack',
  'xslt',
  'other',
]

export function typeGrid (name: string, legend: string, selected: string[]): HTMLFieldSetElement {
  return element('fieldset', { class: 'type-grid' },
    element('legend', { class: 'field__label' }, legend),
    element('div', { class: 'type-grid__options' },
      ...RESOURCE_TYPES.map(type => element('label', { class: 'checkbox' },
        element('input', { type: 'checkbox', name, value: type, checked: selected.includes(type) }),
        type,
      )),
    ),
  )
}
