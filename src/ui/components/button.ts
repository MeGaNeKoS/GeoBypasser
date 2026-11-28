import { element, type Child } from '../dom'
import { icon, type IconName } from '../icons'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

export type ButtonOptions = {
  variant?: ButtonVariant;
  disabled?: boolean;
  busyLabel?: string;
  focusKey?: string;
  type?: 'button' | 'submit';
  onClick?: (event: Event) => void;
}

export function button (label: string, options: ButtonOptions = {}): HTMLButtonElement {
  const busy = options.busyLabel !== undefined
  return element('button', {
    type: options.type ?? 'button',
    class: buttonClass(options.variant ?? 'secondary'),
    disabled: options.disabled || busy,
    'aria-busy': busy ? 'true' : undefined,
    'data-focus-key': options.focusKey,
    onclick: options.onClick,
  }, busy ? options.busyLabel : label)
}

export function iconButton (name: IconName, label: string, onClick: (event: Event) => void): HTMLButtonElement {
  return element('button', {
    type: 'button',
    class: 'button button--icon',
    'aria-label': label,
    title: label,
    onclick: onClick,
  }, icon(name))
}

export function linkButton (label: string, onClick: (event: Event) => void, focusKey?: string): HTMLButtonElement {
  return element('button', {
    type: 'button',
    class: 'link-button',
    'data-focus-key': focusKey,
    onclick: onClick,
  }, label)
}

export function buttonGroup (...children: Child[]): HTMLDivElement {
  return element('div', { class: 'button-row' }, ...children)
}

function buttonClass (variant: ButtonVariant): string {
  if (variant === 'secondary') return 'button'
  if (variant === 'quiet') return 'button button--quiet'
  return `button button--${variant}`
}
