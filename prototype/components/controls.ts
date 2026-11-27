import { element } from '../dom'

export type SwitchOptions = {
  field?: string;
  disabled?: boolean;
  focusKey?: string;
}

export function switchControl (label: string, checked: boolean, onChange?: (checked: boolean) => void, options: SwitchOptions = {}): HTMLButtonElement {
  const state = element('span', {}, checked ? 'On' : 'Off')
  const toggle = element('button', {
    type: 'button',
    class: 'switch',
    role: 'switch',
    'aria-label': label,
    'aria-checked': String(checked),
    'data-field': options.field,
    disabled: options.disabled,
    'data-focus-key': options.focusKey,
  }, element('span', { class: 'switch__track', 'aria-hidden': 'true' }), state)
  toggle.addEventListener('click', () => {
    const next = toggle.getAttribute('aria-checked') !== 'true'
    toggle.setAttribute('aria-checked', String(next))
    state.textContent = next ? 'On' : 'Off'
    onChange?.(next)
  })
  return toggle
}

export function lockedSwitchText (label: string): HTMLSpanElement {
  return element('span', { class: 'badge', 'aria-label': `${label}, locked` }, 'Off, locked')
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  reason?: string;
}

export function segmented<T extends string> (
  legend: string,
  name: string,
  options: SegmentOption<T>[],
  selected: T,
  onChange?: (value: T) => void,
): HTMLFieldSetElement {
  const group = element('fieldset', { class: 'segmented' },
    element('legend', {}, legend),
    element('div', { class: 'segmented__options' }, ...options.map(option => segmentOption(name, option, selected, onChange))),
    ...options.filter(option => option.disabled && option.reason).map(option => element('p', { class: 'help segmented__reason' }, option.reason)),
  )
  return group
}

function segmentOption<T extends string> (name: string, option: SegmentOption<T>, selected: T, onChange?: (value: T) => void): HTMLLabelElement {
  const input = element('input', {
    type: 'radio',
    name,
    value: option.value,
    checked: option.value === selected,
    disabled: option.disabled,
    'data-focus-key': `${name}-${option.value}`,
  })
  input.addEventListener('change', () => onChange?.(option.value))
  return element('label', { class: 'segmented__option' }, input, option.label)
}

export function checkbox (label: string, checked: boolean, onChange: (checked: boolean) => void, focusKey?: string): HTMLLabelElement {
  const input = element('input', { type: 'checkbox', checked, 'data-focus-key': focusKey })
  input.addEventListener('change', () => onChange(input.checked))
  return element('label', { class: 'checkbox' }, input, label)
}
