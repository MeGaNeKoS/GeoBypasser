import { element } from '../dom'
import { icon } from '../icons'

const NOTE_HEADING = 'Other proxy extensions'
const NOTE_BODY = 'Another proxy extension can change where your requests go. Firefox does not let GeoBypass detect this. For predictable routing, run one proxy extension at a time.'

export function otherExtensionsNote (): HTMLElement {
  return element('div', { class: 'note-block', role: 'note' },
    element('p', { class: 'note-block__title' }, icon('info'), NOTE_HEADING),
    element('p', { class: 'note-block__body' }, NOTE_BODY),
  )
}
