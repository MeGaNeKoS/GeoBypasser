import { runStep, sleep, STORAGE_WAIT_MS, TAB_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { captureDownload, clickSelector, clickSiteRowAction, confirmSiteInlineDelete, readLocalStorage } from './smoke-dashboard.mjs'

export const MIXED_KEY = 'Mixed.Example.NET'
export const MIXED_HOST = 'mixed.example.net'
export const MIXED_URL = `http://${MIXED_HOST}/`
const MIXED_PROXY_ID = 'proxy-good'
const MIXED_ROUTE_PROXY_ID = 'mixed-route'
const MIXED_PAC_LINE = `host == "${MIXED_HOST}"`

export function mixedRouteProxy (port) {
  return { id: MIXED_ROUTE_PROXY_ID, label: 'mixed route', type: 'http', proxyDNS: false, host: '127.0.0.1', port, notifyIfDown: false }
}

export async function writeMixedOverride (key, proxyId) {
  const api = globalThis.browser ?? globalThis.chrome
  const { perWebsiteOverride = {} } = await api.storage.local.get('perWebsiteOverride')
  await api.storage.local.set({ perWebsiteOverride: { ...perWebsiteOverride, [key]: proxyId } })
  return true
}

export async function addProxyAsDefault (proxy) {
  const api = globalThis.browser ?? globalThis.chrome
  const { proxyList = [] } = await api.storage.local.get('proxyList')
  await api.storage.local.set({ proxyList: [...proxyList, proxy], defaultProxy: proxy.id })
  return true
}

export async function openPopupBesideTab (tabUrl, popupUrl) {
  const api = globalThis.browser ?? globalThis.chrome
  const [tab] = await api.tabs.query({ url: `${tabUrl}*` })
  if (!tab) throw new Error(`no open tab for ${tabUrl}`)
  const popup = await api.tabs.create({ url: popupUrl, windowId: tab.windowId, active: false })
  return popup.id
}

export async function tabLoadStatus (tabId) {
  const api = globalThis.browser ?? globalThis.chrome
  return (await api.tabs.get(tabId)).status
}

export async function readPopupDomain () {
  return document.getElementById('activeDomain').textContent
}

export async function clickSiteClearInPopup () {
  document.getElementById('scopeSelect').value = 'site'
  document.getElementById('clearProxy').click()
  return true
}

export async function storedKeysForHost (host) {
  const api = globalThis.browser ?? globalThis.chrome
  const { perWebsiteOverride = {} } = await api.storage.local.get('perWebsiteOverride')
  return Object.keys(perWebsiteOverride).filter(key => key.toLowerCase() === host)
}

async function overrideRowLabels () {
  return [...document.querySelectorAll('#overrideContent li.row strong')].map(name => name.textContent)
}

async function dashboardIsMounted () {
  return document.querySelector('section.tab.active') !== null
}

async function openOverrideTab (run) {
  await waitFor(() => run(dashboardIsMounted), STORAGE_WAIT_MS, 'the dashboard to mount')
  await run(clickSelector, ['[data-tab="override"]'])
  await sleep(TAB_SETTLE_MS)
}

async function storedOverrideKeys (run) {
  return Object.keys((await run(readLocalStorage)).perWebsiteOverride ?? {})
}

async function waitForMixedOverrideRow (run) {
  await waitFor(async () => (await run(overrideRowLabels)).includes(MIXED_KEY), STORAGE_WAIT_MS, `the override row for ${MIXED_KEY}`)
}

async function showMixedOverrideOnDashboard (run, reopenDashboard) {
  await run(writeMixedOverride, [MIXED_KEY, MIXED_PROXY_ID])
  await reopenDashboard()
  await openOverrideTab(run)
  await waitForMixedOverrideRow(run)
}

async function deleteMixedOverrideOnDashboard (run) {
  await waitForMixedOverrideRow(run)
  await run(clickSiteRowAction, [MIXED_KEY, 'Delete'])
  await run(confirmSiteInlineDelete)
  await waitFor(async () => !(await storedOverrideKeys(run)).includes(MIXED_KEY), STORAGE_WAIT_MS, 'the dashboard delete to reach storage.local')
}

async function exportMixedOverride (run, reopenDashboard) {
  await run(writeMixedOverride, [MIXED_KEY, MIXED_PROXY_ID])
  await reopenDashboard()
  await openOverrideTab(run)
  await waitForMixedOverrideRow(run)
  const text = await run(captureDownload, ['#overrideContent [data-focus-key="export-all"]'])
  if (text === null) throw new Error('the overrides export wrote no file')
  const exported = JSON.parse(text).perWebsiteOverride ?? {}
  if (exported[MIXED_KEY] !== MIXED_PROXY_ID) throw new Error(`the export holds the keys ${JSON.stringify(Object.keys(exported))}, not ${MIXED_KEY}`)
  await deleteMixedOverrideOnDashboard(run)
}

export async function checkMixedOverrideInDashboard ({ run, reopenDashboard }, failures) {
  await runStep('mixed case override row shows its stored spelling', () => showMixedOverrideOnDashboard(run, reopenDashboard), failures)
  await runStep('mixed case override deleted through the dashboard', () => deleteMixedOverrideOnDashboard(run), failures)
  await runStep('overrides export keeps the stored spelling of a mixed case key', () => exportMixedOverride(run, reopenDashboard), failures)
  console.log(`dashboard: "${MIXED_KEY}" shown with its stored spelling, deleted, and exported with it`)
}

function storeOverrideExpression (key, proxyId) {
  return `chrome.storage.local.get("perWebsiteOverride").then(r => chrome.storage.local.set({ perWebsiteOverride: { ...r.perWebsiteOverride, ${JSON.stringify(key)}: ${JSON.stringify(proxyId)} } })).then(() => true)`
}

function dropOverrideExpression (key) {
  return `chrome.storage.local.get("perWebsiteOverride").then(r => { const overrides = { ...r.perWebsiteOverride }; delete overrides[${JSON.stringify(key)}]; return chrome.storage.local.set({ perWebsiteOverride: overrides }) }).then(() => true)`
}

const PAC_SCRIPT_EXPRESSION = 'chrome.proxy.settings.get({}).then(r => r.value?.pacScript?.data ?? "")'

async function checkPacCarriesMixedOverride (evalIn, worker) {
  await evalIn(worker, storeOverrideExpression(MIXED_KEY, MIXED_PROXY_ID))
  try {
    await waitFor(
      () => evalIn(worker, PAC_SCRIPT_EXPRESSION).then(pac => pac.includes(MIXED_PAC_LINE)),
      STORAGE_WAIT_MS,
      'the PAC script to carry the mixed case override',
    )
  } finally {
    await evalIn(worker, dropOverrideExpression(MIXED_KEY))
  }
  console.log(`PAC carries ${MIXED_PAC_LINE} for the stored key "${MIXED_KEY}"`)
}

export async function checkMixedOverrideInPac ({ evalIn, worker }, failures) {
  await runStep('mixed case override reaches the PAC script', () => checkPacCarriesMixedOverride(evalIn, worker), failures)
}
