import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXTURE, POPUP_SETTLE_MS, sleep, STEP_TIMEOUT_MS, STOP_GRACE_MS, STORAGE_WAIT_MS, TAB_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { checkCredentialWiring } from './smoke-credentials.mjs'
import { checkRevealAndRowExport, checkSetAsideEditSave, checkSetAsideExports, checkSetAsideOnlyAndFocus } from './smoke-set-aside.mjs'
import { checkPacRoute } from './smoke-chrome-route.mjs'
import { COMPONENT_TEST_PAGE, chromeKeyEvents, runComponentTestPage } from './smoke-component-test.mjs'
import { PROTOTYPE_PAGES, missingStylesheets, prototypeProblems, prototypeUrl, readPrototypeState } from './smoke-prototype.mjs'
import { checkMixedOverrideInPac } from './smoke-override-spelling.mjs'
import { checkNetworkStatsNames, CHROME_NETWORK_SCENARIO } from './smoke-network-stats.mjs'
import { checkSectionImportsThroughReview } from './smoke-review-imports.mjs'
import { checkProxyEditSurvivesRuleSave, checkRefusedProxySave, checkRuleAddEditDelete, checkKeepAliveAddEditDelete, checkRuleRowsAfterReread, checkSiteAddEditDelete, checkUrlImport, editSetAsideEntries, removeSetAsideEntries } from './smoke-assertions.mjs'
import { checkSettingChanges } from './smoke-setting-changes.mjs'
import { checkAboutDescription, checkDefaultReadBack, checkNotInControlTest, checkTestAgainstListener } from './smoke-sections.mjs'
import { clickSelector, siteSectionShowsChromeLimit } from './smoke-dashboard.mjs'
import { checkHomeCase, FIRST_TIME_CASE, readHomeState, SET_UP_CASE } from './smoke-home.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const CONFIG_FILE = join(ROOT, '.chrome-cdp.json')
const PROFILE = join(ROOT, '.chrome-profile')
const DEFAULT_CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const norm = p => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

function readRegistry (registryFile) {
  try { return JSON.parse(readFileSync(registryFile, 'utf8')) } catch { return {} }
}

function register (port, registryFile) {
  mkdirSync(dirname(registryFile), { recursive: true })
  writeFileSync(registryFile, JSON.stringify({ ...readRegistry(registryFile), [port]: { project: ROOT, profile: PROFILE } }, null, 2))
}

function osPort () {
  return new Promise((done, reject) => {
    const srv = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => done(port))
    })
  })
}

async function freePort (registryFile) {
  for (;;) {
    const port = await osPort()
    if (!(port in readRegistry(registryFile))) return port
  }
}

async function settings (registryFile) {
  const saved = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {}
  const owner = saved.port === undefined ? undefined : readRegistry(registryFile)[saved.port]
  const ownedElsewhere = owner && norm(owner.project) !== norm(ROOT)
  const port = saved.port === undefined || ownedElsewhere ? await freePort(registryFile) : saved.port
  if (saved.profile !== undefined && saved.profile !== PROFILE) {
    console.warn(`smoke: profile ${saved.profile} is outside the project; using ${PROFILE}`)
  }
  writeFileSync(CONFIG_FILE, JSON.stringify({ port, profile: PROFILE }, null, 2))
  register(port, registryFile)
  return port
}

async function answers (port) {
  return fetch(`http://127.0.0.1:${port}/json/version`).then(() => true, () => false)
}

class Cdp {
  constructor (url) {
    this.ws = new WebSocket(url)
    this.count = 0
    this.pending = new Map()
    this.listeners = []
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data)
      if (m.id) {
        this.pending.get(m.id)(m)
        this.pending.delete(m.id)
      } else {
        for (const listener of this.listeners) listener(m)
      }
    }
  }

  open () {
    return new Promise((done, fail) => {
      this.ws.onopen = done
      this.ws.onerror = fail
    })
  }

  send (method, params = {}, sessionId) {
    return new Promise(done => {
      const id = ++this.count
      this.pending.set(id, done)
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    }).then(m => {
      if (m.error) throw new Error(`${method}: ${m.error.message}`)
      return m.result
    })
  }
}

const failures = []
const unhandled = new Map()
const dialogs = []
const sessions = new Map()
let cdp = null
let child = null
let exited = null
let extId = null
let PORT = null

async function attach (sessionId, type) {
  if (type === 'page' || type === 'service_worker') await cdp.send('Runtime.enable', {}, sessionId)
  if (type === 'page') await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {})
  const session = sessions.get(sessionId)
  if (session) session.ready = true
}

function onEvent (m) {
  if (m.method === 'Target.attachedToTarget') {
    const { sessionId, targetInfo } = m.params
    sessions.set(sessionId, { type: targetInfo.type, url: targetInfo.url })
    attach(sessionId, targetInfo.type).catch(err => failures.push(`attach ${targetInfo.url}: ${err.message}`))
  } else if (m.method === 'Target.detachedFromTarget') {
    sessions.delete(m.params.sessionId)
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails
    unhandled.set(`${m.sessionId}:${d.exceptionId}`, `${sessions.get(m.sessionId)?.url}: ${d.exception?.description || d.text}`)
  } else if (m.method === 'Runtime.exceptionRevoked') {
    unhandled.delete(`${m.sessionId}:${m.params.exceptionId}`)
  } else if (m.method === 'Page.javascriptDialogOpening') {
    dialogs.push(m.params.message)
    cdp.send('Page.handleJavaScriptDialog', { accept: true }, m.sessionId).catch(() => {})
  }
}

async function evalIn (sessionId, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
  if (exceptionDetails) throw new Error(`evaluate failed: ${exceptionDetails.exception?.description || exceptionDetails.text}`)
  return result.value
}

function findWorker () {
  return [...sessions].find(([, s]) => s.ready && s.type === 'service_worker' && s.url.startsWith(`chrome-extension://${extId}/`))?.[0]
}

async function openUrl (url) {
  const { targetId } = await cdp.send('Target.createTarget', { url })
  await waitFor(async () => (await cdp.send('Target.getTargets')).targetInfos.find(t => t.targetId === targetId && t.url === url), STEP_TIMEOUT_MS, `${url} tab`)
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await attach(sessionId, 'page')
  await waitFor(() => evalIn(sessionId, 'document.readyState === "complete"'), STEP_TIMEOUT_MS, `${url} to load`)
  const reached = await evalIn(sessionId, 'location.href')
  if (reached !== url) throw new Error(`opened ${url} but the tab shows ${reached}`)
  return sessionId
}

function openTab (path) {
  return openUrl(`chrome-extension://${extId}/${path}`)
}

function componentDriver (sessionId) {
  return {
    read: readFn => evalIn(sessionId, `(${readFn})()`),
    write: (writeFn, args) => evalIn(sessionId, `(${writeFn})(${args.map(arg => JSON.stringify(arg)).join(', ')})`),
    press: async step => {
      await cdp.send('Page.bringToFront', {}, sessionId)
      for (const event of chromeKeyEvents(step)) await cdp.send('Input.dispatchKeyEvent', event, sessionId)
    },
    setScheme: scheme => cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, sessionId),
    reload: () => cdp.send('Page.reload', {}, sessionId),
  }
}

async function launch (fresh, chromePath) {
  if (fresh) {
    rmSync(PROFILE, { recursive: true, force: true })
    mkdirSync(PROFILE, { recursive: true })
  }
  const log = openSync(join(PROFILE, 'chrome.log'), 'a')
  child = spawn(chromePath, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-unsafe-extension-debugging',
    'about:blank'
  ], { stdio: ['ignore', log, log] })
  exited = new Promise(done => child.on('exit', done))

  const version = await waitFor(() => fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.json()), STEP_TIMEOUT_MS,'Chrome DevTools')
  cdp = new Cdp(version.webSocketDebuggerUrl)
  await cdp.open()
  cdp.listeners.push(onEvent)
  sessions.clear()
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true })

  const loaded = await cdp.send('Extensions.loadUnpacked', { path: DIST })
  extId = loaded.id
  console.log(`extension id ${extId} loaded from ${DIST}`)
}

async function closeChrome () {
  if (cdp) {
    await cdp.send('Browser.close').catch(() => {})
    cdp.ws.close()
    cdp = null
  }
  if (child) {
    await Promise.race([exited, sleep(STOP_GRACE_MS)])
    if (child.exitCode === null) child.kill()
    await exited
    console.log(`chrome exit ${child.exitCode}`)
    child = null
  }
}

function readOptions (env, homeDir) {
  return {
    chromePath: env.SMOKE_CHROME_PATH ?? DEFAULT_CHROME_PATH,
    registryFile: join(homeDir, '.chrome-cdp', 'ports.json')
  }
}

async function runSmoke (options) {
  PORT = await settings(options.registryFile)
  if (await answers(PORT)) throw new Error(`port ${PORT} already answers; refusing to reuse a Chrome this script did not start`)
  console.log(`port ${PORT}, profile ${PROFILE}`)

  await launch(true, options.chromePath)
  const seed = await waitFor(() => findWorker(), STEP_TIMEOUT_MS, 'the service worker to start')
  await waitFor(() => evalIn(seed, 'typeof chrome !== "undefined"'), STEP_TIMEOUT_MS, 'the service worker global')
  const seedDashboard = await openTab('dashboard.html')
  await checkHomeCase(() => evalIn(seedDashboard, `(${readHomeState.toString()})()`), FIRST_TIME_CASE, failures)
  await evalIn(seed,`chrome.storage.local.set(${JSON.stringify(FIXTURE)}).then(() => true)`)
  console.log('fixture written to storage.local')
  await closeChrome()

  await launch(false, options.chromePath)
  const dashboard = await openTab('dashboard.html')
  const runOnDashboard = (fn, args = []) => evalIn(dashboard, `(${fn.toString()})(...${JSON.stringify(args)})`)
  await evalIn(dashboard, 'chrome.runtime.sendMessage({ type: "isTabNetworkMonitored", tabId: 0 }).catch(() => null).then(() => true)')
  await waitFor(() => findWorker(), STEP_TIMEOUT_MS, 'the service worker to start with the stored config')
  console.log('service worker started with the stored config')

  await runOnDashboard(clickSelector, ['[data-tab="override"]'])
  await waitFor(() => runOnDashboard(siteSectionShowsChromeLimit), STORAGE_WAIT_MS, 'the Chrome dashboard to show the sites section as limited on Chrome')
  await checkHomeCase(() => runOnDashboard(readHomeState), SET_UP_CASE, failures)
  const tabs = await evalIn(dashboard, '[...document.querySelectorAll("[data-tab]")].map(b => b.dataset.tab)')
  for (const tab of tabs) {
    await runOnDashboard(clickSelector, [`[data-tab="${tab}"]`])
    await sleep(TAB_SETTLE_MS)
  }
  console.log(`dashboard tabs visited: ${tabs.join(', ')}`)

  await removeSetAsideEntries(runOnDashboard, failures)
  await editSetAsideEntries(runOnDashboard)

  await checkUrlImport(runOnDashboard, failures, async () => dialogs)
  await checkSettingChanges(runOnDashboard, failures)

  await checkRefusedProxySave(runOnDashboard, failures)
  await checkCredentialWiring(runOnDashboard, failures)
  await checkProxyEditSurvivesRuleSave(runOnDashboard, failures)
  await checkRuleRowsAfterReread(runOnDashboard, failures)
  await checkRuleAddEditDelete(runOnDashboard, failures)
  await checkSiteAddEditDelete(runOnDashboard, failures)
  await checkKeepAliveAddEditDelete(runOnDashboard, failures)
  await checkSectionImportsThroughReview(runOnDashboard, failures)
  await checkSetAsideEditSave(runOnDashboard, failures, () => runOnDashboard(() => location.reload()).catch(() => null))
  await checkSetAsideExports(runOnDashboard, failures)
  await checkSetAsideOnlyAndFocus(runOnDashboard, failures)
  await checkRevealAndRowExport(runOnDashboard, failures)
  await checkNetworkStatsNames(runOnDashboard, failures, CHROME_NETWORK_SCENARIO)
  await checkMixedOverrideInPac({ evalIn, worker: findWorker() }, failures)
  await checkPacRoute({ evalIn, worker: findWorker(), dashboard }, failures)
  await checkDefaultReadBack(runOnDashboard, failures)
  await checkTestAgainstListener(runOnDashboard, failures)
  await checkAboutDescription(runOnDashboard, 'chrome', failures)
  const controlSender = await openTab('popup.html')
  await checkNotInControlTest({
    run: runOnDashboard,
    sendFromOtherPage: message => evalIn(controlSender, `chrome.runtime.sendMessage(${JSON.stringify(message)}).catch(() => null).then(() => true)`),
  }, failures)

  const componentTest = await openTab(COMPONENT_TEST_PAGE)
  const componentFailures = await runComponentTestPage(componentDriver(componentTest))
  failures.push(...componentFailures.map(message => `component test: ${message}`))
  console.log(`component test page: ${componentFailures.length} failure(s)`)

  for (const page of PROTOTYPE_PAGES) {
    const prototype = await openUrl(prototypeUrl(page))
    const state = await evalIn(prototype, `(${readPrototypeState})()`)
    failures.push(...prototypeProblems(page, state, missingStylesheets(page)))
    console.log(`prototype ${page}: ${JSON.stringify(state)}`)
  }

  const popup = await openTab('popup.html')
  await sleep(POPUP_SETTLE_MS)
  console.log(`popup page loaded (${await evalIn(popup, 'location.pathname')})`)
}

async function main () {
  const options = readOptions(process.env, homedir())
  let runError = null
  process.on('SIGINT', () => closeChrome().finally(() => process.exit(130)))
  try {
    await runSmoke(options)
  } catch (err) {
    runError = err
  } finally {
    await closeChrome().catch(err => console.error(`shutdown: ${err.message}`))
    if (PORT !== null) console.log(`port ${PORT} after close: ${await answers(PORT) ? 'still answering' : 'closed'}`)
  }

  for (const message of unhandled.values()) failures.push(`uncaught: ${message}`)
  if (runError) failures.push(`run: ${runError.message}`)
  if (failures.length) {
    console.error(`FAIL: ${failures.join('\n')}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: no uncaught exception or unhandled rejection in any page or the service worker; ${dialogs.length} dialog(s) dismissed`)
  }
}

await main()
