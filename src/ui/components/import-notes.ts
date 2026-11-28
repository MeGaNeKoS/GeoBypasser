import { button } from './button'
import { banner } from './feedback'
import { element } from '../dom'

export function importNotesBanner (notes: string[], onDismiss: () => void): HTMLElement | null {
  if (notes.length === 0) return null
  return banner({
    tone: 'warn',
    text: element('ul', {}, ...notes.map(message => element('li', {}, message))),
    action: button('Dismiss', { variant: 'quiet', onClick: onDismiss }),
  })
}
