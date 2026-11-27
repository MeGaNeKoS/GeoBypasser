import { element, replaceContent } from '../dom'
import { button } from './button'
import { skeletonRows, stateBlock } from './feedback'

export type ListState = 'populated' | 'empty' | 'loading' | 'error'

export type StateCopy = {
  emptyTitle: string;
  emptyText?: string;
  errorTitle: string;
}

export function stateBody (state: ListState, copy: StateCopy, populated: () => Node[]): HTMLDivElement {
  const body = element('div', { class: 'stack' })
  const show = (current: ListState): void => replaceContent(body, stateNodes(current, copy, populated, () => show('populated')))
  show(state)
  return body
}

function stateNodes (state: ListState, copy: StateCopy, populated: () => Node[], retry: () => void): Node[] {
  if (state === 'loading') return [skeletonRows(3)]
  if (state === 'empty') return [stateBlock({ title: copy.emptyTitle, text: copy.emptyText })]
  if (state === 'error') {
    return [stateBlock({
      title: copy.errorTitle,
      tone: 'danger',
      action: button('Try again', { onClick: retry }),
    })]
  }
  return populated()
}
