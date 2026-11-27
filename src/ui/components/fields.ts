import { element } from '../dom'
import { icon } from '../icons'

let sequence = 0

function fieldId (name: string): string {
  sequence += 1
  return `${name}-${sequence}`
}

export type FieldOptions = {
  name: string;
  label: string;
  help?: string;
  fault?: string;
  mono?: boolean;
}

export type TextFieldOptions = FieldOptions & {
  value: string;
  type?: 'text' | 'url' | 'number';
  inputMode?: 'numeric' | 'text';
  placeholder?: string;
  suffix?: string;
  autocomplete?: string;
}

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectFieldOptions = FieldOptions & {
  options: SelectOption[];
  selected: string;
}

export function textField (options: TextFieldOptions): HTMLDivElement {
  const id = fieldId(options.name)
  const input = element('input', {
    id,
    name: options.name,
    type: options.type ?? 'text',
    value: options.value,
    inputmode: options.inputMode,
    placeholder: options.placeholder,
    autocomplete: options.autocomplete,
    'aria-invalid': options.fault ? 'true' : undefined,
    spellcheck: 'false',
  })
  const control = options.suffix
    ? element('div', { class: 'field__suffix' }, input, element('span', {}, options.suffix))
    : input
  return fieldFrame(id, options, control, input)
}

export function selectField (options: SelectFieldOptions): HTMLDivElement {
  const id = fieldId(options.name)
  const select = element('select', {
    id,
    name: options.name,
    class: 'select',
    'aria-invalid': options.fault ? 'true' : undefined,
  }, ...options.options.map(option => element('option', {
    value: option.value,
    selected: option.value === options.selected,
    disabled: option.disabled,
  }, option.label)))
  return fieldFrame(id, options, select, select)
}

export function passwordField (options: FieldOptions & { value: string }): HTMLDivElement {
  const id = fieldId(options.name)
  const input = element('input', {
    id,
    name: options.name,
    type: 'password',
    value: options.value,
    autocomplete: 'new-password',
    spellcheck: 'false',
  })
  const show = element('button', { type: 'button', class: 'button', 'aria-pressed': 'false' }, 'Show')
  show.addEventListener('click', () => togglePasswordVisibility(input, show))
  return fieldFrame(id, options, element('div', { class: 'field__suffix' }, input, show), input)
}

function togglePasswordVisibility (input: HTMLInputElement, show: HTMLButtonElement): void {
  const revealed = input.type === 'password'
  input.type = revealed ? 'text' : 'password'
  show.setAttribute('aria-pressed', String(revealed))
  show.textContent = revealed ? 'Hide' : 'Show'
}

function fieldFrame (id: string, options: FieldOptions, control: Node, input: HTMLElement): HTMLDivElement {
  const describedBy = [options.help ? `${id}-help` : '', options.fault ? `${id}-error` : ''].filter(Boolean).join(' ')
  if (describedBy) input.setAttribute('aria-describedby', describedBy)
  return element('div', { class: fieldClass(options) },
    element('label', { class: 'field__label', for: id }, options.label),
    control,
    options.help ? element('p', { class: 'help', id: `${id}-help` }, options.help) : null,
    options.fault ? element('p', { class: 'field__error', id: `${id}-error` }, icon('alert'), options.fault) : null,
  )
}

function fieldClass (options: FieldOptions): string {
  const classes = ['field']
  if (options.mono) classes.push('field--mono')
  if (options.fault) classes.push('field--invalid')
  return classes.join(' ')
}
