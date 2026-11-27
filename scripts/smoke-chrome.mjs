import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canon, FIXTURE, serveImportFile, SET_ASIDE_PROXY, SET_ASIDE_RULE, sleep, URL_IMPORT_FILE, waitFor } from './smoke-fixture.mjs'
import { checkCredentialWiring } from './smoke-credentials.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const CONFIG_FILE = join(ROOT, '.chrome-cdp.json')
const PROFILE = join(ROOT, '.chrome-profile')
const REGISTRY = join(homedir(), '.chrome-cdp', 'ports.json')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const STEP_TIMEOUT = 20000

const norm = p => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

function readRegistry () {
  try { return JSON.parse(readFileSync(REGISTRY, 'utf8')) } catch { return {} }
}

function register (port) {
  mkdirSync(dirname(REGISTRY), { recursive: true })
  writeFileSync(REGISTRY, JSON.stringify({ ...readRegistry(), [port]: { project: ROOT, profile: PROFILE } }, null, 2))
}

function osPort () {
  return new Promise((done, reject) => {
    const srv = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => done(port))
    })
  })
}

async function freePort () {
  for (;;) {
    const port = await osPort()
    if (!(port in readRegistry())) return port
  }
}

async function settings () {
  const saved = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {}
  const owner = saved.port === undefined ? undefined : readRegistry()[saved.port]
  const ownedElsewhere = owner && norm(owner.project) !== norm(ROOT)
  const port = saved.port === undefined || ownedElsewhere ? await freePort() : saved.port
  if (saved.profile !== undefined && saved.profile !== PROFILE) {
    console.warn(`smoke: profile ${saved.profile} is outside the project; using ${PROFILE}`)
  }
  writeFileSync(CONFIG_FILE, JSON.stringify({ port, profile: PROFILE }, null, 2))
  register(port)
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

async function openTab (path) {
  const url = `chrome-extension://${extId}/${path}`
  const { targetId } = await cdp.send('Target.createTarget', { url })
  await waitFor(async () => (await cdp.send('Target.getTargets')).targetInfos.find(t => t.targetId === targetId && t.url === url), STEP_TIMEOUT, `${path} tab`)
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  await attach(sessionId, 'page')
  await waitFor(() => evalIn(sessionId, 'document.readyState === "complete"'), STEP_TIMEOUT, `${path} to load`)
  const reached = await evalIn(sessionId, 'location.href')
  if (reached !== url) throw new Error(`opened ${url} but the tab shows ${reached}`)
  return sessionId
}

async function launch (fresh) {
  if (fresh) {
    rmSync(PROFILE, { recursive: true, force: true })
    mkdirSync(PROFILE, { recursive: true })
  }
  const log = openSync(join(PROFILE, 'chrome.log'), 'a')
  child = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-unsafe-extension-debugging',
    'about:blank'
  ], { stdio: ['ignore', log, log] })
  exited = new Promise(done => child.on('exit', done))

  const version = await waitFor(() => fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.json()), STEP_TIMEOUT, 'Chrome DevTools')
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
    await Promise.race([exited, sleep(10000)])
    if (child.exitCode === null) child.kill()
    await exited
    console.log(`chrome exit ${child.exitCode}`)
    child = null
  }
}

async function runSmoke () {
  PORT = await settings()
  if (await answers(PORT)) throw new Error(`port ${PORT} already answers; refusing to reuse a Chrome this script did not start`)
  console.log(`port ${PORT}, profile ${PROFILE}`)

  await launch(true)
  const seed = await waitFor(() => findWorker(), STEP_TIMEOUT, 'the service worker to start')
  await evalIn(seed, `chrome.storage.local.set(${JSON.stringify(FIXTURE)}).then(() => true)`)
  console.log('fixture written to storage.local')
  await closeChrome()

  await launch(false)
  const dashboard = await openTab('dashboard.html')
  await evalIn(dashboard, 'chrome.runtime.sendMessage({ type: "isTabNetworkMonitored", tabId: 0 }).catch(() => null).then(() => true)')
  await waitFor(() => findWorker(), STEP_TIMEOUT, 'the service worker to start with the stored config')
  console.log('service worker started with the stored config')

  const tabs = await evalIn(dashboard, '[...document.querySelectorAll("[data-tab]")].map(b => b.dataset.tab)')
  for (const tab of tabs) {
    await evalIn(dashboard, `document.querySelector(${JSON.stringify(`[data-tab="${tab}"]`)}).click()`)
    await sleep(200)
  }
  console.log(`dashboard tabs visited: ${tabs.join(', ')}`)

  await evalIn(dashboard, 'document.querySelector(\'[data-tab="rules"]\').click()')
  await evalIn(dashboard, `document.querySelector('#ruleTable button[data-remove="${SET_ASIDE_RULE}"]').click()`)
  await evalIn(dashboard, `document.querySelector('#proxyTable button[data-remove="${SET_ASIDE_PROXY}"]').click()`)

  const expected = {
    ...FIXTURE,
    rules: FIXTURE.rules.filter((_, i) => i !== SET_ASIDE_RULE),
    proxyList: FIXTURE.proxyList.filter((_, i) => i !== SET_ASIDE_PROXY)
  }
  await waitFor(async () => {
    const stored = await evalIn(dashboard, 'chrome.storage.local.get(null)')
    return canon(stored.rules) === canon(expected.rules) && canon(stored.proxyList) === canon(expected.proxyList)
  }, 10000, 'the removal to reach storage.local')
  const stored = await evalIn(dashboard, 'chrome.storage.local.get(null)')
  for (const key of Object.keys(FIXTURE)) {
    if (canon(stored[key]) !== canon(expected[key])) failures.push(`storage ${key} differs after removal`)
  }
  console.log(`removed rule row ${SET_ASIDE_RULE} and proxy row ${SET_ASIDE_PROXY}; storage holds every other entry unchanged`)

  const importFile = await serveImportFile(JSON.stringify(URL_IMPORT_FILE))
  const dialogsBefore = dialogs.length
  try {
    await evalIn(dashboard, `(() => {
      document.getElementById('importUrlInput').value = ${JSON.stringify(importFile.url)}
      document.getElementById('importUrlBtn').click()
    })()`)
    await waitFor(async () => {
      const rules = await evalIn(dashboard, 'chrome.storage.local.get(null).then(s => s.rules)')
      return rules.some(rule => rule?.name === 'url valid rule')
    }, 10000, 'the URL import to reach storage.local').catch(err => {
      failures.push(`${err.message}; dialogs shown: ${JSON.stringify(dialogs.slice(dialogsBefore))}`)
    })
  } finally {
    await importFile.close()
  }
  const importedRules = await evalIn(dashboard, 'chrome.storage.local.get(null).then(s => s.rules)')
  if (importedRules.some(rule => rule?.name === 'url refused rule')) failures.push('storage gained the refused URL import rule')
  if (canon(importedRules.slice(0, expected.rules.length)) !== canon(expected.rules)) {
    failures.push('storage rules stored before the URL import changed')
  }
  if (!dialogs.slice(dialogsBefore).some(message => message.includes('url refused rule'))) {
    failures.push('no message named the refused URL import rule')
  }
  console.log(`URL import from ${importFile.url}: valid rule stored, refused rule not stored, message shown`)

  const proxiesBeforeRefusal = await evalIn(dashboard, 'chrome.storage.local.get(null).then(s => s.proxyList)')
  await evalIn(dashboard, `(() => {
    document.querySelector('[data-tab="proxy"]').click()
    document.getElementById('addProxy').click()
    document.getElementById('proxyHost').value = 'a:1; PROXY x:8080'
    document.getElementById('proxyPort').value = '8080'
    document.getElementById('saveProxy').click()
  })()`)
  await sleep(500)
  const proxiesAfterRefusal = await evalIn(dashboard, 'chrome.storage.local.get(null).then(s => s.proxyList)')
  if (canon(proxiesAfterRefusal) !== canon(proxiesBeforeRefusal)) failures.push('storage proxyList changed after a refused proxy save')
  if (!await evalIn(dashboard, 'document.getElementById("proxyHost").classList.contains("invalid")')) {
    failures.push('the proxy host field is not marked after a refused proxy save')
  }
  console.log('refused proxy save with host "a:1; PROXY x:8080": storage unchanged, host field marked')

  await checkCredentialWiring((fn, args = []) => evalIn(dashboard, `(${fn.toString()})(...${JSON.stringify(args)})`), failures)

  const popup = await openTab('popup.html')
  await sleep(1000)
  console.log(`popup page loaded (${await evalIn(popup, 'location.pathname')})`)
}

let runError = null
process.on('SIGINT', () => closeChrome().finally(() => process.exit(130)))
try {
  await runSmoke()
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
