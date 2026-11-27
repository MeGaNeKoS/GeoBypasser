import { patternList } from '@ui/components/pattern-list'
import { usageTree, type TreeNode } from '@ui/components/tree'
import { expect } from './check-log'
import { awaitKey } from './key-steps'
import { mount } from './stage'

const USAGE: TreeNode[] = [
  { name: 'Parent', sent: '1 KB', received: '2 KB', children: [{ name: 'Child', sent: '512 B', received: '512 B', children: [] }] },
]

function rowsOf (list: HTMLElement): number {
  return list.querySelector('.pattern-list')?.children.length ?? 0
}

export async function checkPatternListAddRemove (): Promise<void> {
  const list = mount(patternList({ field: 'pattern', label: 'Patterns', patterns: ['alpha'], placeholder: 'pattern' }))
  list.querySelector<HTMLButtonElement>('.button-row button')?.focus()
  await awaitKey('pattern-add', 'space')
  expect(rowsOf(list) === 2, 'Space on Add pattern did not add a row')
  expect(document.activeElement instanceof HTMLInputElement && list.contains(document.activeElement), 'a new pattern row did not take focus')
  list.querySelectorAll<HTMLButtonElement>('.pattern-list__row button')[1]?.focus()
  await awaitKey('pattern-remove', 'space')
  expect(rowsOf(list) === 1, 'Space on Remove did not remove the row')
}

export function checkPatternRowFaults (): void {
  const list = mount(patternList({
    field: 'faulty',
    label: 'Faulty',
    patterns: ['bad', 'ok'],
    faults: { 0: 'Pattern is not valid' },
    placeholder: 'pattern',
  }))
  const [bad, good] = list.querySelectorAll('input')
  const error = document.getElementById(bad?.getAttribute('aria-describedby') ?? '')
  expect(bad?.getAttribute('aria-invalid') === 'true', 'faulty pattern row did not set aria-invalid')
  expect(error?.textContent?.includes('Pattern is not valid') === true, 'faulty pattern row did not link aria-describedby to its message')
  expect(good?.getAttribute('aria-invalid') === null, 'valid pattern row was marked invalid')
  expect(good?.getAttribute('aria-describedby') === null, 'valid pattern row points at an error message')
}

function chevronTransform (chevron: Element | null | undefined): string {
  return chevron ? getComputedStyle(chevron).transform : 'none'
}

export async function checkTreeOpenAndClosed (): Promise<void> {
  const tree = mount(usageTree(USAGE))
  const node = tree.querySelector('details')
  const summary = node?.querySelector('summary')
  const chevron = summary?.querySelector('.icon')
  expect(node?.open === true, 'tree node was not open by default')
  expect(chevronTransform(chevron) === 'none', 'open tree node chevron is rotated')
  summary?.focus()
  await awaitKey('tree-space', 'space')
  expect(node?.open === false, 'Space on a focused tree node did not close it')
  expect(chevronTransform(chevron) !== 'none', 'closed tree node chevron is not rotated')
}
