import { button } from '@ui/components/button'
import { expect } from './check-log'
import { awaitKey } from './key-steps'
import { mount } from './stage'
import { currentScheme, type Scheme } from './scheme'

type SchemeTokens = { focus: string; background: string; text: string }

const TOKENS: Record<Scheme, SchemeTokens> = {
  light: { focus: 'rgb(31, 95, 214)', background: 'rgb(246, 247, 249)', text: 'rgb(23, 26, 33)' },
  dark: { focus: 'rgb(138, 180, 255)', background: 'rgb(16, 18, 22)', text: 'rgb(232, 234, 238)' },
}

export async function checkFocusRingAndTokens (): Promise<void> {
  const before = mount(button('Before'))
  const target = mount(button('Focus me'))
  before.focus()
  await awaitKey('focus-ring', 'tab')
  expect(document.activeElement === target, 'Tab did not move focus to the next control')
  expect(target.matches(':focus-visible'), 'keyboard focus does not match :focus-visible')
  const tokens = TOKENS[currentScheme()]
  const ring = getComputedStyle(target)
  expect(ring.outlineStyle === 'solid', `focus ring style is ${ring.outlineStyle}, not solid`)
  expect(ring.outlineColor === tokens.focus, `focus ring colour ${ring.outlineColor} is not ${tokens.focus}`)
  const body = getComputedStyle(document.body)
  expect(body.backgroundColor === tokens.background, `page background ${body.backgroundColor} is not ${tokens.background}`)
  expect(body.color === tokens.text, `page text colour ${body.color} is not ${tokens.text}`)
}
