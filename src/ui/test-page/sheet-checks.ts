import { button } from '@ui/components/button'
import { draftValue, openSheet, type SheetSpec } from '@ui/components/sheet'
import { element } from '@ui/dom'
import { expect } from './check-log'
import { awaitKey } from './key-steps'
import { mount } from './stage'

const NAME_FIELD = 'name'
const DISCARD_PROMPT = 'Discard changes?'

function nameSheet (): SheetSpec {
  return {
    title: 'Edit name',
    saveLabel: 'Save',
    draft: { [NAME_FIELD]: [''] },
    render: draft => [element('input', { type: 'text', name: NAME_FIELD, value: draftValue(draft, NAME_FIELD), 'aria-label': 'Name' })],
    validate: () => [],
    save: () => {},
  }
}

function openedSheet (): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('dialog.sheet')
}

function promptShown (dialog: HTMLDialogElement | null | undefined): boolean {
  return dialog?.textContent?.includes(DISCARD_PROMPT) === true
}

export async function checkSheetFlow (): Promise<void> {
  const opener = mount(button('Open sheet', { onClick: () => openSheet(nameSheet()) }))
  opener.focus()
  await awaitKey('sheet-open', 'space')
  const clean = openedSheet()
  expect(clean?.open === true, 'Space on the opener did not open the sheet')
  expect(clean !== null && clean.contains(document.activeElement), 'focus did not move into the sheet on open')

  await awaitKey('sheet-tab-cycle', 'tab-cycle')
  expect(clean?.contains(document.activeElement) === true, 'Tab moved focus out of the open sheet')

  await awaitKey('sheet-escape-clean', 'escape')
  expect(clean?.isConnected === false, 'Escape on a clean sheet did not close it')
  expect(document.activeElement === opener, 'closing a clean sheet did not return focus to the opener')

  opener.focus()
  await awaitKey('sheet-reopen', 'space')
  const dirty = openedSheet()
  const name = dirty?.querySelector<HTMLInputElement>(`input[name="${NAME_FIELD}"]`)
  name?.focus()
  await awaitKey('sheet-type', 'type-x')
  expect(name?.value === 'x', 'typing into the sheet did not change its field')

  await awaitKey('sheet-escape-dirty', 'escape')
  expect(dirty?.open === true && promptShown(dirty), 'Escape on a dirty sheet did not show the discard prompt')

  await awaitKey('sheet-escape-keep', 'escape')
  expect(dirty?.open === true && !promptShown(dirty), 'Escape on the discard prompt did not return to editing')

  await awaitKey('sheet-escape-dirty-again', 'escape')
  expect(promptShown(dirty), 'Escape on a dirty sheet did not show the discard prompt the second time')

  await awaitKey('sheet-discard', 'shift-tab-space')
  expect(dirty?.isConnected === false, 'Discard did not close the sheet')
}
