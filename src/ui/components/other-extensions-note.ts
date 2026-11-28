import { element } from '../dom'
import { noteBlock } from './note-block'

const NOTE_HEADING = 'Other proxy extensions'
const NOTE_BODY = 'Another proxy extension can change where your requests go. Firefox does not let GeoBypass detect this. For predictable routing, run one proxy extension at a time.'

export function otherExtensionsNote (detail?: string): HTMLElement {
  return noteBlock(NOTE_HEADING,
    element('p', { class: 'note-block__body' }, NOTE_BODY),
    detail === undefined ? null : element('p', { class: 'note-block__body' }, detail),
  )
}
