import { createServer } from 'node:http'
import { runStep, sleep, STORAGE_WAIT_MS, TAB_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
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

export function openMonitoredFixtureTab (pageUrl) {
  const api = globalThis.browser ?? globalThis.chrome
  return api.tabs.create({ url: pageUrl }).then(async tab => {
    await api.runtime.sendMessage({ type: 'monitorTabNetwork', tabId: tab.id })
    await api.tabs.reload(tab.id)
    return tab.id
  })
}

export function closeFixtureTab (tabId) {
  const api = globalThis.browser ?? globalThis.chrome
  return api.tabs.remove(tabId)
}

export function refreshNetworkSection () {
  const refresh = [...document.querySelectorAll('#networkContent button')].find(button => button.textContent === 'Refresh')
  if (!refresh) throw new Error('no Refresh button in the Network section')
  refresh.click()
}

export function readNetworkSnapshot (host) {
  const row = document.querySelector(`tr[data-host="${host}"]`)
  const monitor = document.querySelector(`[role="switch"][aria-label="Monitor: ${host}"]`)
  return {
    text: document.getElementById('networkContent').textContent,
    row: row ? { page: row.dataset.page, types: row.dataset.types, route: row.dataset.route, result: row.dataset.result } : null,
    monitored: monitor ? monitor.getAttribute('aria-checked') === 'true' : null,
    monitorSwitches: document.querySelectorAll('[role="switch"][aria-label^="Monitor: "]').length,
  }
}

export function expandRowDetails (host) {
  const row = document.querySelector(`tr[data-host="${host}"]`)
  if (!row) throw new Error(`no row for ${host}`)
  const details = [...row.querySelectorAll('button')].find(button => button.textContent === 'Details')
  if (!details) throw new Error(`no Details button for ${host}`)
  details.click()
}

export function setTabMonitoringFromPage (tabId, monitored) {
  const api = globalThis.browser ?? globalThis.chrome
  return api.runtime.sendMessage({ type: monitored ? 'monitorTabNetwork' : 'unmonitorTabNetwork', tabId })
}

export async function openTabFromPage (url) {
  const api = globalThis.browser ?? globalThis.chrome
  const tab = await api.tabs.create({ url })
  return tab.id
}

export function closeTabFromPage (tabId) {
  const api = globalThis.browser ?? globalThis.chrome
  return api.tabs.remove(tabId)
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

async function waitForLiveSnapshot (run, condition, what) {
  await waitFor(async () => condition(await run(readNetworkSnapshot, [FIXTURE_HOST])), STORAGE_WAIT_MS, what)
}

function assertSnapshot (condition, message) {
  if (!condition) throw new Error(message)
}

function treeSegments (paths) {
  return paths.flatMap(path => path.split('/').filter(Boolean))
}

async function checkLiveMonitoringFromAnotherPage (run, tabId, openAnotherPage) {
  const otherPage = await openAnotherPage()
  try {
    await otherPage.run(setTabMonitoringFromPage, [tabId, false])
    await waitForLiveSnapshot(run, state => state.monitored === false, 'the Tabs switch to read off without Refresh')
    await otherPage.run(setTabMonitoringFromPage, [tabId, true])
    await waitForLiveSnapshot(run, state => state.monitored === true, 'the Tabs switch to read on without Refresh')
  } finally {
    await otherPage.close()
  }
}

async function checkNewTabAppearsLive (run, pageUrl, openAnotherPage) {
  const otherPage = await openAnotherPage()
  try {
    await waitForLiveSnapshot(run, state => state.monitorSwitches > 0, 'the Tabs card to list the fixture tab')
    const before = (await run(readNetworkSnapshot, [FIXTURE_HOST])).monitorSwitches
    const newTabId = await otherPage.run(openTabFromPage, [pageUrl])
    await waitForLiveSnapshot(run, state => state.monitorSwitches === before + 1, 'a newly opened tab to appear in the Tabs card without Refresh')
    await otherPage.run(closeTabFromPage, [newTabId])
    await waitForLiveSnapshot(run, state => state.monitorSwitches === before, 'the closed tab to leave the Tabs card without Refresh')
  } finally {
    await otherPage.close()
  }
}

async function checkRecordedRequests (run, pageUrl, scenario, openAnotherPage, serverHits) {
  const tabId = await run(openMonitoredFixtureTab, [pageUrl])
  let failure = null
  try {
    await run(clickSelector, ['[data-tab="network"]'])
    await sleep(TAB_SETTLE_MS)
    const snapshot = await waitForSnapshot(run, state => state.row !== null && state.monitored === true, `a row for ${FIXTURE_HOST} with its tab switch on`)
    assertSnapshot(snapshot.monitored === true, `the fixture tab switch reads ${snapshot.monitored} instead of true`)
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
    await checkLiveMonitoringFromAnotherPage(run, tabId, openAnotherPage)
    await checkNewTabAppearsLive(run, pageUrl, openAnotherPage)
  } catch (err) {
    failure = err
    throw err
  } finally {
    await run(closeFixtureTab, [tabId]).catch(closeErr => {
      if (failure === null) throw closeErr
    })
  }
}

export async function checkNetworkStatsNames (run, failures, scenario, openAnotherPage) {
  const fixture = await serveNetworkFixture(scenario.paths)
  try {
    await runStep('network stats show recorded requests from a monitored tab', () => checkRecordedRequests(run, `${fixture.origin}${FIXTURE_PAGE_PATH}`, scenario, openAnotherPage, fixture.serverHits), failures)
  } finally {
    await fixture.close()
  }
}
