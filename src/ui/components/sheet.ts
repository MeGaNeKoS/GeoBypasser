import { element, replaceContent } from '../dom'
import { icon } from '../icons'
import { button, iconButton, linkButton } from './button'

export type Draft = Record<string, string[]>

export type Fault = {
  field: string;
  message: string;
}

export type SheetSpec = {
  title: string;
  saveLabel: string;
  draft: Draft;
  initialFaults?: Fault[];
  saveDisabled?: boolean;
  footer?: (close: () => void) => Node[];
  render: (draft: Draft, faults: Fault[], close: () => void) => Node[];
  validate: (draft: Draft) => Fault[];
  save: (draft: Draft) => void;
  closed?: () => void;
}

export function faultFor (faults: Fault[], field: string): string | undefined {
  return faults.find(fault => fault.field === field)?.message
}

export function faultsOnOpen (entryFaults: string[], draft: Draft, validate: (draft: Draft) => Fault[]): Fault[] {
  return entryFaults.length === 0 ? [] : validate(draft)
}

export function draftOf (values: Record<string, string | string[] | boolean>): Draft {
  return Object.fromEntries(Object.entries(values).map(([field, value]) => [field, valuesOf(value)]))
}

function valuesOf (value: string | string[] | boolean): string[] {
  if (Array.isArray(value)) return value
  return [String(value)]
}

export function draftValue (draft: Draft, field: string): string {
  return draft[field]?.[0] ?? ''
}

export function draftValues (draft: Draft, field: string): string[] {
  return draft[field] ?? []
}

export function draftFlag (draft: Draft, field: string): boolean {
  return draft[field]?.[0] === 'true'
}

export function openSheet (spec: SheetSpec): HTMLDialogElement {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const body = element('div', { class: 'sheet__body', tabindex: '-1' })
  const footer = element('footer', { class: 'sheet__footer' })
  const form = element('form', { novalidate: true, class: 'sheet__form' }, body, footer)
  const dialog = element('dialog', { class: 'sheet', 'aria-label': spec.title, tabindex: '-1' })
  let current = spec.draft
  let pristine = ''
  let discardPending = false

  function showBody (faults: Fault[]): void {
    const nodes = spec.render(current, faults, requestClose)
    replaceContent(body, faults.length ? [faultSummary(faults, field => focusField(body, field)), ...nodes] : nodes)
    applyConditionals(form)
  }

  function requestClose (): void {
    if (isDirty()) {
      showDiscardPrompt()
      return
    }
    closeSheet()
  }

  function escapeSheet (): void {
    if (discardPending) {
      showFooter()
      return
    }
    requestClose()
  }

  function isDirty (): boolean {
    return JSON.stringify(readDraft(form)) !== pristine
  }

  function showDiscardPrompt (): void {
    discardPending = true
    const keep = button('Keep editing', { variant: 'secondary', focusKey: 'keep-editing', onClick: () => showFooter() })
    const discard = button('Discard', { variant: 'danger', onClick: () => closeSheet() })
    replaceContent(footer, [element('div', { class: 'inline-confirm', role: 'group' },
      element('span', { class: 'inline-confirm__question' }, 'Discard changes?'),
      discard,
      keep,
    )], 'keep-editing')
  }

  function showFooter (): void {
    discardPending = false
    replaceContent(footer, spec.footer ? spec.footer(requestClose) : defaultFooter())
    footer.querySelector<HTMLElement>('button[type="button"]')?.focus()
  }

  function defaultFooter (): Node[] {
    return [
      button(spec.saveLabel, { variant: 'primary', disabled: spec.saveDisabled ?? false, onClick: submitDraft }),
      button('Cancel', { onClick: requestClose }),
    ]
  }

  function submitDraft (): void {
    current = readDraft(form)
    const faults = spec.validate(current)
    if (faults.length) {
      showBody(faults)
      focusField(body, faults[0].field)
      return
    }
    spec.save(current)
    closeSheet()
  }

  function closeSheet (): void {
    dialog.close()
    dialog.remove()
    opener?.focus()
    spec.closed?.()
  }

  dialog.append(
    element('div', { class: 'sheet__header' },
      element('h2', { class: 'sheet__title' }, spec.title),
      iconButton('close', 'Close', requestClose),
    ),
    form,
  )
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    escapeSheet()
  })
  dialog.addEventListener('cancel', event => {
    event.preventDefault()
    escapeSheet()
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    submitDraft()
  })
  form.addEventListener('change', () => applyConditionals(form))
  const initialFaults = spec.initialFaults ?? []
  showBody(initialFaults)
  pristine = JSON.stringify(readDraft(form))
  showFooter()
  document.body.append(dialog)
  dialog.showModal()
  if (initialFaults.length > 0) focusField(body, initialFaults[0].field)
  return dialog
}

function faultSummary (faults: Fault[], focus: (field: string) => void): HTMLDivElement {
  const count = faults.length
  return element('div', { class: 'banner banner--danger', role: 'alert' },
    icon('alert'),
    element('div', { class: 'banner__text' },
      element('p', {}, `${count} ${count === 1 ? 'thing' : 'things'} to fix`),
      element('ul', {}, ...faults.map(fault => element('li', {}, linkButton(fault.message, () => focus(fault.field))))),
    ),
  )
}

function applyConditionals (form: HTMLFormElement): void {
  const draft = readDraft(form)
  for (const node of form.querySelectorAll<HTMLElement>('[data-show-when]')) {
    const [field, value] = (node.dataset.showWhen ?? '').split('=')
    node.hidden = draftValue(draft, field) !== value
  }
}

function focusField (container: HTMLElement, field: string): void {
  container.querySelector<HTMLElement>(`[name="${field}"], [data-field="${field}"]`)?.focus()
}

export function readDraft (form: HTMLFormElement): Draft {
  const draft: Draft = {}
  for (const [name, value] of new FormData(form)) {
    draft[name] = [...(draft[name] ?? []), String(value)]
  }
  for (const toggle of form.querySelectorAll<HTMLElement>('[role="switch"][data-field]')) {
    draft[toggle.dataset.field ?? ''] = [String(toggle.getAttribute('aria-checked') === 'true')]
  }
  return draft
}

export function setCheckedInputs (event: Event, selector: string, checked: boolean): void {
  const form = (event.currentTarget as Element).closest('form')
  form?.querySelectorAll<HTMLInputElement>(selector).forEach(input => {
    input.checked = checked
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
