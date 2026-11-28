import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep, STEP_TIMEOUT_MS, STORAGE_WAIT_MS, UI_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { readLocalStorage } from './smoke-dashboard.mjs'
import { startRecordingListener } from './smoke-chrome-route.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LISTENER_TEST_URL = 'http://test-check.example/'
const BLOCKED_REASON = 'Tests cannot run while GeoBypass does not control proxy settings.'
const NOT_IN_EFFECT_SENTENCE = 'Your settings are saved but not in effect.'

export function openHash (hash) {
  location.hash = hash
}

export function readFallbackSwitch () {
  return document.querySelector('#defaultsContent [role="switch"][data-field="fallbackDirect"]').getAttribute('aria-checked')
}

export function clickFallbackSwitch () {
  document.querySelector('#defaultsContent [role="switch"][data-field="fallbackDirect"]').click()
}

export function fillTestField (name, value) {
  const input = document.querySelector(`#testContent [name="${name}"]`)
  input.value = value
  input.dispatchEvent(new Event('change'))
}

export function clickTestButton (focusKey) {
  const button = document.querySelector(`#testContent [data-focus-key="${focusKey}"]`)
  if (!button) throw new Error(`no Test button with focus key ${focusKey}`)
  button.click()
}

export function readTestSection () {
  const buttons = ['test-saved', 'test-custom'].map(focusKey => {
    const button = document.querySelector(`#testContent [data-focus-key="${focusKey}"]`)
    return { focusKey, present: button !== null, disabled: button?.disabled ?? null }
  })
  return { status: document.querySelector('#testContent [role="status"]')?.textContent ?? null, buttons }
}

export function readAboutParagraphs () {
  return Array.from(document.querySelectorAll('#aboutContent p')).map(p => p.textContent)
}

export function readHomeStatusLine () {
  return document.querySelector('#homeContent .home-status__line')?.textContent ?? null
}

function testIsBlocked (section) {
  return section.buttons.every(button => button.disabled === true) && section.status === BLOCKED_REASON
}

function testIsOpen (section) {
  return section.buttons.every(button => button.disabled === false)
}

export async function checkDefaultReadBack (run, failures) {
  await run(openHash, ['#defaults'])
  await sleep(UI_SETTLE_MS)
  const before = await run(readFallbackSwitch)
  await run(clickFallbackSwitch)
  const wanted = before !== 'true'
  try {
    await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === wanted, STORAGE_WAIT_MS, 'the fallback change to reach storage.local')
    const shown = await run(readFallbackSwitch)
    if (shown !== String(wanted)) failures.push(`defaults: the switch shows ${shown} after the change, expected ${wanted}`)
  } finally {
    await run(clickFallbackSwitch)
    await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === (before === 'true'), STORAGE_WAIT_MS, 'the fallback switch to be restored')
  }
  console.log(`defaults: fallbackDirect changed to ${wanted} and read back from storage.local`)
}

export async function checkTestAgainstListener (run, failures) {
  const { server, port, requests } = await startRecordingListener()
  try {
    await run(openHash, ['#test'])
    await run(fillTestField, ['testProxyUrl', LISTENER_TEST_URL])
    await sleep(UI_SETTLE_MS)
    await run(fillTestField, ['testHost', '127.0.0.1'])
    await run(fillTestField, ['testPort', String(port)])
    await sleep(UI_SETTLE_MS)
    await run(clickTestButton, ['test-custom'])
    const status = await waitFor(async () => {
      const text = (await run(readTestSection)).status
      return /^(Connected|Failed)/.test(text ?? '') ? text : null
    }, STEP_TIMEOUT_MS, 'the Test result from the local listener')
    const expected = `Connected through 127.0.0.1:${port}`
    if (status !== expected) failures.push(`test: the result reads "${status}", expected "${expected}"`)
    if (!requests.includes(LISTENER_TEST_URL)) failures.push(`test: the listener saw ${JSON.stringify(requests)}, not ${LISTENER_TEST_URL}`)
    console.log(`test against the local listener: ${status}`)
  } finally {
    server.closeAllConnections()
    await new Promise(done => server.close(done))
  }
}

export async function checkAboutDescription (run, browser, failures) {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifests', browser, 'manifest.json'), 'utf8'))
  await run(openHash, ['#about'])
  const paragraphs = await waitFor(async () => {
    const shown = await run(readAboutParagraphs)
    return shown.includes(manifest.description) ? shown : null
  }, STEP_TIMEOUT_MS, `the About page to show the ${browser} description`)
  if (!paragraphs.includes(manifest.description)) failures.push(`about: no paragraph reads "${manifest.description}"`)
  console.log(`about (${browser}): ${manifest.description}`)
}

export async function checkNotInControlTest ({ run, sendFromOtherPage }, failures) {
  const notInControl = { type: 'proxyControlChanged', state: 'overridden' }
  const inControl = { type: 'proxyControlChanged', state: 'active' }

  await run(openHash, ['#test'])
  await sendFromOtherPage(notInControl)
  await waitFor(async () => testIsBlocked(await run(readTestSection)), STORAGE_WAIT_MS, 'the Test buttons to disable when not in control')
  await sendFromOtherPage(inControl)
  await waitFor(async () => testIsOpen(await run(readTestSection)), STORAGE_WAIT_MS, 'the Test buttons to enable when back in control')
  console.log('test section: buttons disabled with the reason when not in control, and enabled again when back')

  await run(openHash, ['#home'])
  await sendFromOtherPage(notInControl)
  const shownNotInEffect = await waitFor(async () => (await run(readHomeStatusLine))?.includes(NOT_IN_EFFECT_SENTENCE), STORAGE_WAIT_MS, 'the Home status to show not in effect')
  if (!shownNotInEffect) failures.push('home: the status line does not show the not-in-effect sentence when not in control')
  await sendFromOtherPage(inControl)
  await waitFor(async () => {
    const line = await run(readHomeStatusLine)
    return line !== null && !line.includes(NOT_IN_EFFECT_SENTENCE)
  }, STORAGE_WAIT_MS, 'the Home status to recover when back in control')
  console.log('home: status line shows not in effect when not in control, and recovers when back')
}
