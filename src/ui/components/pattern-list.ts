import { element } from '../dom'
import { icon } from '../icons'
import { button } from './button'

export type PatternListOptions = {
  field: string;
  label: string;
  patterns: string[];
  faults?: Record<number, string>;
  placeholder: string;
  help?: string;
  addRowAside?: HTMLElement;
}

export function patternList (options: PatternListOptions): HTMLDivElement {
  const rows = element('div', { class: 'pattern-list' },
    ...(options.patterns.length ? options.patterns : ['']).map((pattern, index) => patternRow(options, pattern, options.faults?.[index])),
  )
  const add = button('Add pattern', { onClick: () => rows.append(patternRow(options, '', undefined, true)) })
  return element('div', { class: 'field' },
    element('span', { class: 'field__label' }, options.label),
    rows,
    element('div', { class: 'button-row' }, add, options.addRowAside ?? null),
    options.help ? element('p', { class: 'help' }, options.help) : null,
  )
}

let errorSequence = 0

function patternRow (options: PatternListOptions, pattern: string, fault: string | undefined, focus = false): HTMLDivElement {
  const errorId = fault ? `pattern-error-${errorSequence += 1}` : undefined
  const input = element('input', {
    type: 'text',
    name: options.field,
    value: pattern,
    class: 'input input--mono',
    placeholder: options.placeholder,
    'aria-label': options.label,
    'aria-invalid': fault ? 'true' : undefined,
    'aria-describedby': errorId,
  })
  const remove = button('Remove', { onClick: () => row.remove() })
  const row = element('div', { class: 'stack stack--tight' },
    element('div', { class: 'pattern-list__row' }, input, remove),
    fault ? element('p', { class: 'field__error', id: errorId }, icon('alert'), fault) : null,
  )
  if (focus) queueMicrotask(() => input.focus())
  return row
}
