import { element } from '../dom'
import { button } from './button'

export type InlineConfirmOptions = {
  question: string;
  confirmLabel: string;
  groupLabel: string;
  pendingKey: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function inlineConfirm (options: InlineConfirmOptions): HTMLElement {
  return element('div', { class: 'inline-confirm', role: 'group', 'aria-label': options.groupLabel },
    element('span', { class: 'inline-confirm__question' }, options.question),
    button(options.confirmLabel, { variant: 'danger', focusKey: `confirm-${options.pendingKey}`, onClick: options.onConfirm }),
    button('Cancel', { focusKey: `cancel-${options.pendingKey}`, onClick: options.onCancel }),
  )
}
