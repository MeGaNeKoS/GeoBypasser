import { element } from '@ui/dom'
import { button } from '@ui/components/button'
import { disclosure } from '@ui/components/disclosure'
import { segmented, switchControl } from '@ui/components/controls'
import { textField } from '@ui/components/fields'
import { RESOURCE_TYPES, typeGrid } from '@ui/components/type-grid'
import { stateBody, type ListState } from '@ui/components/state-body'
import { expect } from './check-log'
import { awaitKey } from './key-steps'
import { mount } from './stage'

const ROWS_TEXT = 'Rows'
const STATE_COPY = { emptyTitle: 'Nothing here', emptyText: 'Add one to start', errorTitle: 'Could not load' }
const SEGMENT_OPTIONS = [
  { value: 'tab', label: 'This tab' },
  { value: 'site', label: 'This site' },
]

export function checkButtonRunsHandler (): void {
  let clicks = 0
  mount(button('Count', { onClick: () => { clicks += 1 } })).click()
  expect(clicks === 1, 'button did not run its click handler once')
}

export function checkSwitchToggles (): void {
  let reported: boolean | undefined
  const control = mount(switchControl('Monitor', false, checked => { reported = checked }))
  control.click()
  expect(control.getAttribute('aria-checked') === 'true', 'switch did not show checked after a click')
  expect(reported === true, 'switch did not report its new value')
}

export async function checkSwitchSpace (): Promise<void> {
  let reported: boolean | undefined
  const control = mount(switchControl('Notify', false, checked => { reported = checked }))
  control.focus()
  await awaitKey('switch-space', 'space')
  expect(control.getAttribute('aria-checked') === 'true', 'Space on a focused switch did not turn it on')
  expect(reported === true, 'switch did not report its value after Space')
}

export function checkSegmentedSelects (): void {
  let chosen: string | undefined
  const group = mount(segmented('Scope', 'scope-click', SEGMENT_OPTIONS, 'tab', value => { chosen = value }))
  group.querySelector<HTMLInputElement>('input[value="site"]')?.click()
  expect(chosen === 'site', 'segmented control did not report the chosen option')
}

export async function checkSegmentedArrow (): Promise<void> {
  let chosen: string | undefined
  const group = mount(segmented('Scope', 'scope-arrow', SEGMENT_OPTIONS, 'tab', value => { chosen = value }))
  group.querySelector<HTMLInputElement>('input[value="tab"]')?.focus()
  await awaitKey('segmented-arrow', 'arrow-right')
  expect(group.querySelector<HTMLInputElement>('input[value="site"]')?.checked === true, 'ArrowRight did not select the next segmented option')
  expect(chosen === 'site', 'segmented control did not report the option chosen by ArrowRight')
}

export function checkDisclosureOpens (): void {
  const details = mount(disclosure('Advanced', 'Show', false, element('p', {}, 'Body')))
  details.querySelector('summary')?.click()
  expect(details.open, 'disclosure did not open when its summary was clicked')
}

function bodyText (state: ListState): string {
  return mount(stateBody(state, STATE_COPY, () => [element('p', {}, ROWS_TEXT)])).textContent ?? ''
}

export function checkStateBodyShowsEachState (): void {
  expect(bodyText('populated').includes(ROWS_TEXT), 'populated state did not show the rows')
  expect(bodyText('empty').includes(STATE_COPY.emptyTitle), 'empty state did not show its title')
  expect(bodyText('error').includes(STATE_COPY.errorTitle), 'error state did not show its title')
  const loading = bodyText('loading')
  expect(!loading.includes(ROWS_TEXT) && !loading.includes(STATE_COPY.emptyTitle), 'loading state showed other content')
}

export function checkStateBodyRetryFromError (): void {
  const body = mount(stateBody('error', STATE_COPY, () => [element('p', {}, ROWS_TEXT)]))
  body.querySelector('button')?.click()
  expect(body.textContent?.includes(ROWS_TEXT) === true, 'error state retry did not show the rows')
}

export function checkFieldError (): void {
  const field = mount(textField({ name: 'host', label: 'Host', value: '', fault: 'Enter a host name' }))
  const input = field.querySelector('input')
  const error = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
  expect(input?.getAttribute('aria-invalid') === 'true', 'field error did not set aria-invalid on the input')
  expect(error?.textContent?.includes('Enter a host name') === true, 'field error did not link aria-describedby to its message')
}

export async function checkTypeGridToggle (): Promise<void> {
  const grid = mount(typeGrid('types', 'Resource types', ['document']))
  const boxes = [...grid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
  expect(boxes.length === RESOURCE_TYPES.length, 'type grid did not render every resource type')
  expect(boxes.find(box => box.value === 'document')?.checked === true, 'type grid did not check the selected type')
  const script = boxes.find(box => box.value === 'script')
  script?.focus()
  await awaitKey('type-space', 'space')
  expect(script?.checked === true, 'Space on a focused resource type did not check it')
}
