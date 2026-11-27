import { sleep } from './smoke-fixture.mjs'

const POLL_MS = 20
const DRIVE_TIMEOUT_MS = 60000
const NOTHING_YET = { awaiting: null, outcome: null }
const TAB_CYCLE_PRESSES = 12

export const COMPONENT_TEST_PAGE = 'component-test.html'
export const COMPONENT_TEST_SCHEMES = ['light', 'dark']

export const KEY_STEPS = {
  space: ['Space'],
  tab: ['Tab'],
  'tab-cycle': Array(TAB_CYCLE_PRESSES).fill('Tab'),
  escape: ['Escape'],
  'type-x': ['x'],
  'shift-tab-space': ['Shift+Tab', 'Space'],
  'arrow-right': ['ArrowRight'],
}

const CHROME_KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  Space: { key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
  x: { key: 'x', code: 'KeyX', text: 'x', windowsVirtualKeyCode: 88 },
}
const CHROME_MODIFIER_BITS = { Shift: 8 }
const FIREFOX_KEYS = { Tab: '', Escape: '', Space: ' ', ArrowRight: '', x: 'x' }
const FIREFOX_MODIFIERS = { Shift: '' }

function pressesFor (step) {
  const presses = KEY_STEPS[step]
  if (!presses) throw new Error(`no key sequence for component test step ${step}`)
  return presses
}

function splitPress (press) {
  const parts = press.split('+')
  return { key: parts.pop(), modifiers: parts }
}

export function chromeKeyEvents (step) {
  return pressesFor(step).flatMap(press => {
    const { key, modifiers } = splitPress(press)
    const bits = modifiers.reduce((sum, name) => sum + CHROME_MODIFIER_BITS[name], 0)
    const { text, ...keyParams } = CHROME_KEYS[key]
    const down = { type: 'keyDown', modifiers: bits, ...keyParams, ...(text ? { text } : {}) }
    return [down, { type: 'keyUp', modifiers: bits, ...keyParams }]
  })
}

export function firefoxKeyActions (step) {
  return pressesFor(step).flatMap(press => {
    const { key, modifiers } = splitPress(press)
    const value = FIREFOX_KEYS[key]
    const modifierDown = modifiers.map(name => ({ type: 'keyDown', value: FIREFOX_MODIFIERS[name] }))
    const modifierUp = modifiers.map(name => ({ type: 'keyUp', value: FIREFOX_MODIFIERS[name] })).reverse()
    return [...modifierDown, { type: 'keyDown', value }, { type: 'keyUp', value }, ...modifierUp]
  })
}

export function readComponentTestPage () {
  const { awaitingKey, awaitingStep } = document.body.dataset
  const outcome = document.getElementById('component-test-outcome')
  return {
    awaiting: awaitingKey ? { key: awaitingKey, step: awaitingStep } : null,
    outcome: outcome ? { scheme: outcome.dataset.scheme, failures: JSON.parse(outcome.dataset.failures) } : null,
  }
}

export function markKeyStepDone (key) {
  document.body.dataset.keysDone = key
}

async function driveComponentTest ({ read, write, press, scheme }) {
  const deadline = Date.now() + DRIVE_TIMEOUT_MS
  let handledKey = null
  for (;;) {
    const state = await read(readComponentTestPage).catch(() => NOTHING_YET)
    if (state.outcome?.scheme === scheme) return state.outcome.failures
    if (state.awaiting && state.awaiting.key !== handledKey) {
      handledKey = state.awaiting.key
      await press(state.awaiting.step)
      await write(markKeyStepDone, [handledKey])
    }
    if (Date.now() > deadline) throw new Error(`the component test page did not finish in ${scheme}`)
    await sleep(POLL_MS)
  }
}

export async function runComponentTestPage ({ read, write, press, setScheme, reload }) {
  const failures = []
  for (const scheme of COMPONENT_TEST_SCHEMES) {
    await setScheme(scheme)
    await reload()
    const found = await driveComponentTest({ read, write, press, scheme })
    failures.push(...found.map(message => `${scheme}: ${message}`))
  }
  return failures
}
