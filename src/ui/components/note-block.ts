import { element } from '../dom'
import type { Child } from '../dom'
import { icon } from '../icons'

export function noteBlock (heading: string, ...body: Child[]): HTMLElement {
  return element('div', { class: 'note-block', role: 'note' },
    element('p', { class: 'note-block__title' }, icon('info'), heading),
    ...body,
  )
}
