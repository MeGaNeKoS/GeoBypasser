import { createServer } from 'node:http'
import { POPUP_SETTLE_MS, runStep, sleep, STEP_TIMEOUT_MS, STORAGE_WAIT_MS, TAB_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { clickSelector } from './smoke-dashboard.mjs'

const FIXTURE_HOST = '127.0.0.1'
const FIXTURE_PAGE_PATH = '/page/'
const CHROME_NOTE = 'Chrome does not report the route each request used.'

export const CHROME_NETWORK_SCENARIO = {
  paths: ['/constructor/__proto__/'],
  chrome: true,
}

export const FIREFOX_NETWORK_SCENARIO = {
  paths: ['/constructor/__proto__/', '/alpha/beta/'],
  chrome: false,
}

function fixturePageHtml (paths) {
  const requests = paths.map(path => `fetch(${JSON.stringify(path)}, { mode: 'no-cors', cache: 'no-store' });`).join('\n')
  return `<!doctype html><title>Network fixture</title><script>\n${requests}\n</script>`
}

async function serveNetworkFixture (paths) {
  const page = fixturePageHtml(paths)
  const hits = new Map()
  const server = createServer((request, response) => {
    const hitUrl = `${request.headers.host}${request.url}`
    hits.set(hitUrl, (hits.get(hitUrl) ?? 0) + 1)
    const isPage = request.url === FIXTURE_PAGE_PATH
    response.writeHead(200, { 'content-type': isPage ? 'text/html' : 'text/plain' })
    response.end(isPage ? page : 'ok')
  })
  await new Promise(done => server.listen(0, FIXTURE_HOST, done))
  return {
    origin: `http://${FIXTURE_HOST}:${server.address().port}`,
    serverHits: () => Object.fromEntries(hits),
    close: () => new Promise(done => server.close(done)),
  }
}

export async function openFixtureTab (pageUrl) {
  const api = globalThis.browser ?? globalThis.chrome
  const window = await api.windows.getCurrent()
  const tab = await api.tabs.create({ url: pageUrl, windowId: window.id, active: true })
  return tab.id
}

export async function fixtureTabLoadedAt (tabId, pageUrl) {
  const api = globalThis.browser ?? globalThis.chrome
  const tab = await api.tabs.get(tabId)
  return tab.url === pageUrl && tab.status === 'complete'
}

export async function readFixtureMonitoring (tabId) {
  const api = globalThis.browser ?? globalThis.chrome
  const monitored = await api.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId })
  const tab = await api.tabs.get(tabId)
  return { monitored, active: tab.active }
}

export function reloadFixtureTab (tabId) {
  const api = globalThis.browser ?? globalThis.chrome
  return api.tabs.reload(tabId).then(() => true)
}

export function closeFixtureTab (tabId) {
  const api = globalThis.browser ?? globalThis.chrome
  return api.tabs.remove(tabId)
}

export function readMonitorState () {
  const monitor = document.querySelector('[role="switch"][aria-label="Monitor this tab"]')
  return monitor ? monitor.getAttribute('aria-checked') === 'true' : null
}

export function turnMonitorOn () {
  const monitor = document.querySelector('[role="switch"][aria-label="Monitor this tab"]')
  if (monitor.getAttribute('aria-checked') !== 'true') monitor.click()
  return true
}

export function refreshNetworkSection () {
  const refresh = [...document.querySelectorAll('#networkContent button')].find(button => button.textContent === 'Refresh')
  if (!refresh) throw new Error('no Refresh button in the Network section')
  refresh.click()
}

export function readNetworkSnapshot (host) {
  const row = document.querySelector(`tr[data-host="${host}"]`)
  return {
    text: document.getElementById('networkContent').textContent,
    row: row ? { page: row.dataset.page, types: row.dataset.types, route: row.dataset.route, result: row.dataset.result } : null,
  }
}

export function expandRowDetails (host) {
  const row = document.querySelector(`tr[data-host="${host}"]`)
  if (!row) throw new Error(`no row for ${host}`)
  const details = [...row.querySelectorAll('button')].find(button => button.textContent === 'Details')
  if (!details) throw new Error(`no Details button for ${host}`)
  details.click()
}

async function waitForSnapshot (run, condition, what) {
  let snapshot
  await waitFor(async () => {
    await run(refreshNetworkSection)
    snapshot = await run(readNetworkSnapshot, [FIXTURE_HOST])
    return condition(snapshot)
  }, STORAGE_WAIT_MS, what)
  return snapshot
}

function assertSnapshot (condition, message) {
  if (!condition) throw new Error(message)
}

function treeSegments (paths) {
  return paths.flatMap(path => path.split('/').filter(Boolean))
}

async function turnMonitorOnFromPopup (openPopupBeside, pageUrl) {
  const popup = await openPopupBeside(pageUrl)
  try {
    await waitFor(() => popup.run(readMonitorState).then(state => state !== null), STEP_TIMEOUT_MS, 'the popup Monitor this tab switch')
    await sleep(POPUP_SETTLE_MS)
    await popup.run(turnMonitorOn)
    await waitFor(() => popup.run(readMonitorState).then(state => state === true), STORAGE_WAIT_MS, 'the popup Monitor this tab switch to read on')
  } finally {
    await popup.close()
  }
}

async function checkRecordedRequests (run, pageUrl, scenario, openPopupBeside, serverHits) {
  const tabId = await run(openFixtureTab, [pageUrl])
  let failure = null
  try {
    await waitFor(() => run(fixtureTabLoadedAt, [tabId, pageUrl]), STEP_TIMEOUT_MS, 'the fixture tab to load')
    await turnMonitorOnFromPopup(openPopupBeside, pageUrl)
    const monitoring = await run(readFixtureMonitoring, [tabId])
    assertSnapshot(monitoring.monitored === true, `after the popup switch read on, the fixture tab ${tabId} reads ${JSON.stringify(monitoring)}`)
    await run(reloadFixtureTab, [tabId])
    await run(clickSelector, ['[data-tab="network"]'])
    await sleep(TAB_SETTLE_MS)
    const snapshot = await waitForSnapshot(run, state => state.row !== null, `a row for ${FIXTURE_HOST} from the monitored tab`)
    assertSnapshot(snapshot.row.result.includes('OK'), `row results were "${snapshot.row.result}"`)
    assertSnapshot(snapshot.row.route !== '', 'row has no route')
    assertSnapshot(snapshot.row.page !== '', 'row has no page')
    if (scenario.chrome) {
      assertSnapshot(snapshot.text.includes(CHROME_NOTE), 'the Chrome route note is missing')
    }
    await run(expandRowDetails, [FIXTURE_HOST])
    const expanded = await waitForSnapshot(
      run,
      state => treeSegments(scenario.paths).every(segment => state.text.includes(segment)),
      `the path tree to show ${treeSegments(scenario.paths).join(', ')}`,
    ).catch(async err => {
      const seen = await run(readNetworkSnapshot, [FIXTURE_HOST])
      const missing = treeSegments(scenario.paths).filter(segment => !seen.text.includes(segment))
      throw new Error(`${err.message}; missing ${missing.join(', ')}; server hits ${JSON.stringify(serverHits())}; the Network content read was: ${seen.text}`)
    })
    assertSnapshot(expanded.text.includes('__proto__'), 'the path tree lost __proto__')
  } catch (err) {
    failure = err
    throw err
  } finally {
    await run(closeFixtureTab, [tabId]).catch(closeErr => {
      if (failure === null) throw closeErr
    })
  }
}

export async function checkNetworkStatsNames (run, failures, scenario, openPopupBeside) {
  const fixture = await serveNetworkFixture(scenario.paths)
  try {
    await runStep('network stats show recorded requests from a monitored tab', () => checkRecordedRequests(run, `${fixture.origin}${FIXTURE_PAGE_PATH}`, scenario, openPopupBeside, fixture.serverHits), failures)
  } finally {
    await fixture.close()
  }
}
