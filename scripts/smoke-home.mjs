import { STEP_TIMEOUT_MS, waitFor } from './smoke-fixture.mjs'

export const FIRST_TIME_CASE = {
  name: 'first time',
  heading: 'Welcome to GeoBypass',
  statusPrefix: null,
  getStarted: true,
  quickActions: false,
}

export const SET_UP_CASE = {
  name: 'set up',
  heading: 'Home',
  statusPrefix: 'Routing is on.',
  getStarted: false,
  quickActions: true,
}

export function readHomeState () {
  const home = document.getElementById('homeContent')
  return {
    heading: home?.querySelector('h2')?.textContent ?? null,
    busy: home?.getAttribute('aria-busy') ?? null,
    statusLine: home?.querySelector('.home-status__line')?.textContent ?? null,
    getStarted: [...(home?.querySelectorAll('h3') ?? [])].some(title => title.textContent === 'Get started'),
    buttons: [...(home?.querySelectorAll('button') ?? [])].map(button => button.textContent),
    text: home?.textContent?.trim().slice(0, 200) ?? null,
  }
}

export async function checkHomeCase (readHome, expected, failures) {
  let last = null
  const shown = await waitFor(async () => {
    last = await readHome()
    return last.heading !== null && last.busy === null ? last : null
  }, STEP_TIMEOUT_MS, `Home to show the ${expected.name} case`).catch(() => null)
  if (shown === null) {
    failures.push(`home ${expected.name} case: not shown, last read ${JSON.stringify(last)}`)
    return
  }

  const problems = []
  if (shown.heading !== expected.heading) problems.push(`heading "${shown.heading}"`)
  const statusMatches = expected.statusPrefix === null
    ? shown.statusLine === null
    : shown.statusLine?.startsWith(expected.statusPrefix) === true
  if (!statusMatches) problems.push(`status "${shown.statusLine}"`)
  if (shown.getStarted !== expected.getStarted) problems.push(`Get started shown: ${shown.getStarted}`)
  if (shown.buttons.includes('Add rule') !== expected.quickActions) problems.push(`quick actions shown: ${!expected.quickActions}`)

  if (problems.length) failures.push(`home ${expected.name} case: ${problems.join('; ')}`)
  else console.log(`home ${expected.name} case shown: heading "${shown.heading}"`)
}
