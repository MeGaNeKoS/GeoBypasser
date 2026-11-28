import { element } from '../dom'
import { button } from './button'
import { faultLine } from './fields'

export type PatternListOptions = {
  field: string;
  label: string;
  patterns: string[];
  faults?: Record<number, string>;
  fault?: string;
  placeholder: string;
  help?: string;
  addRowAside?: HTMLElement;
  addLabel?: string;
}

type PatternRowState = {
  pattern: string;
  fault: string | undefined;
  markInvalid: boolean;
  focus: boolean;
}

export function patternList (options: PatternListOptions): HTMLDivElement {
  const rows = element('div', { class: 'pattern-list' },
    ...(options.patterns.length ? options.patterns : ['']).map((pattern, index) => patternRow(options, {
      pattern,
      fault: options.faults?.[index],
      markInvalid: index === 0 && options.fault !== undefined,
      focus: false,
    })),
  )
  const add = button(options.addLabel ?? 'Add pattern', {
    onClick: () => rows.append(patternRow(options, { pattern: '', fault: undefined, markInvalid: false, focus: true })),
  })
  return element('div', { class: 'field' },
    element('span', { class: 'field__label' }, options.label),
    rows,
    element('div', { class: 'button-row' }, add, options.addRowAside ?? null),
    options.help ? element('p', { class: 'help' }, options.help) : null,
    options.fault === undefined ? null : faultLine(options.fault),
  )
}

let errorSequence = 0

function patternRow (options: PatternListOptions, state: PatternRowState): HTMLDivElement {
  const errorId = state.fault ? `pattern-error-${errorSequence += 1}` : undefined
  const invalid = state.fault !== undefined || state.markInvalid
  const input = element('input', {
    type: 'text',
    name: options.field,
    value: state.pattern,
    class: invalid ? 'input input--mono input--invalid' : 'input input--mono',
    placeholder: options.placeholder,
    'aria-label': options.label,
    'aria-invalid': invalid ? 'true' : undefined,
    'aria-describedby': errorId,
  })
  const remove = button('Remove', { onClick: () => frame.remove() })
  const frame = element('div', { class: 'stack stack--tight' },
    element('div', { class: 'pattern-list__row' }, input, remove),
    state.fault ? faultLine(state.fault, errorId) : null,
  )
  if (state.focus) queueMicrotask(() => input.focus())
  return frame
}
