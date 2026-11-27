import { element } from '@ui/dom'

export const stage = element('main', { id: 'stage' })

export function mount<T extends HTMLElement> (node: T): T {
  stage.append(node)
  return node
}
