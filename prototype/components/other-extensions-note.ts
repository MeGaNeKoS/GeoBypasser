import { element } from '../dom'
import { icon } from '../icons'
import type { Browser } from '../model'

const HEADING = 'Other proxy extensions'
const BODY = 'Another proxy extension can change where your requests go. Firefox does not let GeoBypass detect this. For predictable routing, run one proxy extension at a time.'

export function otherExtensionsNote (browser: Browser, extra?: string): HTMLElement | null {
  if (browser !== 'firefox') return null
  return element('section', { class: 'note', role: 'note' },
    icon('info'),
    element('div', { class: 'stack' },
      element('h3', { class: 'group-label' }, HEADING),
      element('p', { class: 'help' }, extra ? `${BODY} ${extra}` : BODY),
    ),
  )
}
