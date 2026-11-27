import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canon, FIXTURE, serveImportFile, SET_ASIDE_PROXY, SET_ASIDE_RULE, sleep, URL_IMPORT_FILE, waitFor } from './smoke-fixture.mjs'
import { connectOnce, MarionetteClient } from './smoke-marionette.mjs'
import { checkCredentialWiring } from './smoke-credentials.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(process.argv[2] ?? join(ROOT, 'dist'))
const WORK = join(ROOT, '.chrome-cdp-work')
const PROFILE = join(WORK, 'firefox-profile')
const SMOKE_DIST = join(WORK, 'firefox-smoke-dist')
const SMOKE_ADDON_ID = 'geobypass-smoke@localhost'
const FIREFOX = 'C:/Program Files/Mozilla Firefox/firefox.exe'
const STEP_TIMEOUT = 20000
const CHROME_SANDBOX = 'smoke'

const PREFS = port => [
  ['marionette.port', port],
  ['app.update.enabled', false],
  ['extensions.update.enabled', false],
  ['extensions.getAddons.cache.enabled', false],
  ['extensions.blocklist.enabled', false],
  ['datareporting.healthreport.uploadEnabled', false],
  ['datareporting.policy.dataSubmissionEnabled', false],
  ['toolkit.telemetry.enabled', false],
  ['toolkit.telemetry.unified', false],
  ['browser.safebrowsing.malware.enabled', false],
  ['browser.safebrowsing.phishing.enabled', false],
  ['network.captive-portal-service.enabled', false],
  ['network.connectivity-service.enabled', false],
  ['network.prefetch-next', false],
  ['network.dns.disablePrefetch', true],
  ['browser.send_pings', false],
  ['browser.region.update.enabled', false],
  ['browser.aboutwelcome.enabled', false],
  ['browser.shell.checkDefaultBrowser', false],
  ['browser.startup.homepage_override.mstone', 'ignore']
]

const failures = []
const dialogs = []
let firefox = null
let exited = null
let marionette = null
let recording = false
let sessionOrigin = null

function freePort () {
  return new Promise((done, reject) => {
    const server = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}

function requireFirefoxManifest () {
  const manifestFile = join(DIST, 'manifest.json')
  if (!existsSync(manifestFile)) throw new Error(`no extension manifest in ${DIST}`)
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!manifest.browser_specific_settings?.gecko) {
    throw new Error(`${DIST} is not a Firefox build: its manifest has no browser_specific_settings.gecko`)
  }
}

function prepareSmokeDist () {
  requireFirefoxManifest()
  rmSync(SMOKE_DIST, { recursive: true, force: true })
  cpSync(DIST, SMOKE_DIST, { recursive: true })
  const manifestFile = join(SMOKE_DIST, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  manifest.browser_specific_settings.gecko.id = SMOKE_ADDON_ID
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
}

function resetProfile () {
  rmSync(PROFILE, { recursive: true, force: true })
  mkdirSync(PROFILE, { recursive: true })
}

function writePrefs (port) {
  const lines = PREFS(port).map(([name, value]) => `user_pref(${JSON.stringify(name)}, ${JSON.stringify(value)});`)
  writeFileSync(join(PROFILE, 'user.js'), `${lines.join('\n')}\n`)
}

function launchFirefox (port) {
  writePrefs(port)
  const log = openSync(join(PROFILE, 'firefox.log'), 'a')
  firefox = spawn(FIREFOX, ['-no-remote', '-profile', PROFILE, '--marionette', '--headless', 'about:blank'], {
    stdio: ['ignore', log, log],
    env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' }
  })
  exited = new Promise(done => firefox.on('exit', done))
}

const wrap = fn => `const done = arguments[arguments.length - 1];
Promise.resolve().then(() => (${fn.toString()})(...Array.prototype.slice.call(arguments, 0, -1)))
  .then(value => done({ ok: true, value }), error => done({ ok: false, error: String(error && error.stack || error) }))`

async function evaluate (fn, args = [], context = 'content') {
  await marionette.send('Marionette:SetContext', { value: context })
  const sandbox = context === 'chrome' ? { sandbox: CHROME_SANDBOX } : {}
  const { value } = await marionette.send('WebDriver:ExecuteAsyncScript', { script: wrap(fn), args, ...sandbox })
  if (!value.ok) throw new Error(value.error)
  return value.value
}

async function takeDialogs () {
  if (recording) dialogs.push(...await evaluate(drainDialogs))
}

async function navigate (url) {
  await takeDialogs()
  await marionette.send('Marionette:SetContext', { value: 'content' })
  await marionette.send('WebDriver:Navigate', { url })
  await evaluate(recordDialogs)
  recording = true
}

async function openSession () {
  const port = await freePort()
  launchFirefox(port)
  const socket = await waitFor(() => connectOnce(port), STEP_TIMEOUT, 'the Marionette port')
  marionette = new MarionetteClient(socket)
  await marionette.handshake()
  await marionette.send('WebDriver:NewSession', {})
  await evaluate(listenForErrors, [], 'chrome')
  const addonId = (await marionette.send('Addon:Install', { path: SMOKE_DIST, temporary: true })).value
  const uuid = await evaluate(policyHost, [addonId], 'chrome')
  sessionOrigin = `moz-extension://${uuid}/`
  console.log(`firefox pid ${firefox.pid} on marionette port ${port}; extension ${addonId} at ${sessionOrigin}`)
  return { origin: sessionOrigin }
}

async function closeSession () {
  if (marionette) {
    await takeDialogs().catch(err => failures.push(`could not read dialogs: ${err.message}`))
    const errors = await evaluate(collectErrors, [sessionOrigin ?? 'moz-extension://'], 'chrome').catch(err => {
      failures.push(`could not read console errors: ${err.message}`)
      return []
    })
    failures.push(...errors.map(message => `uncaught: ${message}`))
    await marionette.send('Marionette:Quit', { flags: ['eAttemptQuit'] }).catch(() => {})
    marionette.close()
    marionette = null
  }
  recording = false
  if (firefox) {
    await Promise.race([exited, sleep(10000)])
    if (firefox.exitCode === null) firefox.kill()
    await exited
    console.log(`firefox exit ${firefox.exitCode}`)
    firefox = null
  }
}

async function seedFixture (session) {
  await navigate(`${session.origin}dashboard.html`)
  await evaluate(seedStorage, [FIXTURE])
  console.log('fixture written to storage.local')
}

async function checkStartupFromStorage (session) {
  await navigate(`${session.origin}dashboard.html`)
  await waitFor(() => evaluate(pingBackground), STEP_TIMEOUT, 'the background to answer in the second session')
  console.log('background answered in the second session, after a restart with the stored config')
}

async function visitDashboardTabs () {
  const tabs = await evaluate(dashboardTabs)
  if (!tabs.includes('override')) failures.push('dashboard has no website overrides tab')
  for (const tab of tabs) {
    await evaluate(clickTab, [tab])
    await sleep(200)
  }
  console.log(`dashboard tabs visited: ${tabs.join(', ')}`)
}

function expectedAfterRemoval () {
  return {
    ...FIXTURE,
    rules: FIXTURE.rules.filter((_, i) => i !== SET_ASIDE_RULE),
    proxyList: FIXTURE.proxyList.filter((_, i) => i !== SET_ASIDE_PROXY)
  }
}

async function removeSetAsideEntries () {
  await evaluate(clickTab, ['rules'])
  await evaluate(removeRow, ['ruleTable', SET_ASIDE_RULE])
  await evaluate(removeRow, ['proxyTable', SET_ASIDE_PROXY])
  const expected = expectedAfterRemoval()
  await waitFor(async () => {
    const stored = await evaluate(readStorage)
    return canon(stored.rules) === canon(expected.rules) && canon(stored.proxyList) === canon(expected.proxyList)
  }, 10000, 'the removal to reach storage.local')
  const stored = await evaluate(readStorage)
  for (const key of Object.keys(FIXTURE)) {
    if (canon(stored[key]) !== canon(expected[key])) failures.push(`storage ${key} differs after removal`)
  }
  console.log(`removed rule row ${SET_ASIDE_RULE} and proxy row ${SET_ASIDE_PROXY}; storage holds every other entry unchanged`)
}

async function importRulesFromUrl () {
  const importFile = await serveImportFile(JSON.stringify(URL_IMPORT_FILE))
  try {
    await evaluate(importFromUrl, [importFile.url])
    await waitFor(async () => {
      const stored = await evaluate(readStorage)
      return stored.rules.some(rule => rule?.name === 'url valid rule')
    }, 10000, 'the URL import to reach storage.local')
  } catch (err) {
    failures.push(err.message)
  } finally {
    await importFile.close()
  }
  const imported = await evaluate(readStorage)
  const expected = expectedAfterRemoval()
  if (imported.rules.some(rule => rule?.name === 'url refused rule')) failures.push('storage gained the refused URL import rule')
  if (canon(imported.rules.slice(0, expected.rules.length)) !== canon(expected.rules)) {
    failures.push('storage rules stored before the URL import changed')
  }
  await takeDialogs()
  if (!dialogs.some(message => message.includes('url refused rule'))) failures.push('no message named the refused URL import rule')
  console.log(`URL import from ${importFile.url}: valid rule stored, refused rule not stored, message shown`)
}

async function refuseInvalidProxySave () {
  const before = (await evaluate(readStorage)).proxyList
  await evaluate(refuseProxySave)
  await sleep(500)
  const after = (await evaluate(readStorage)).proxyList
  if (canon(after) !== canon(before)) failures.push('storage proxyList changed after a refused proxy save')
  if (!await evaluate(proxyHostMarkedInvalid)) failures.push('the proxy host field is not marked after a refused proxy save')
  console.log('refused proxy save with host "a:1; PROXY x:8080": storage unchanged, host field marked')
}

async function setTabProxyFromPopup (session) {
  await takeDialogs()
  recording = false
  const { handle } = await marionette.send('WebDriver:NewWindow', { type: 'tab' })
  await marionette.send('WebDriver:SwitchToWindow', { handle, focus: true })
  await navigate(`${session.origin}popup.html`)
  await waitFor(() => evaluate(popupProxyListReady), STEP_TIMEOUT, 'the popup proxy list in its own tab')
  const tabId = await evaluate(setTabProxy, ['proxy-good'])
  await waitFor(async () => (await evaluate(readTabProxies))[tabId] === 'proxy-good', 10000, 'the tab proxy to reach storage.local')
  console.log(`popup set tab ${tabId} to proxy-good; tabProxyMap holds it`)
}

async function runFirefoxSmoke () {
  prepareSmokeDist()
  resetProfile()

  const first = await openSession()
  await seedFixture(first)
  await closeSession()

  const second = await openSession()
  await checkStartupFromStorage(second)
  await visitDashboardTabs()
  await removeSetAsideEntries()
  await importRulesFromUrl()
  await refuseInvalidProxySave()
  await checkCredentialWiring(evaluate, failures)
  await setTabProxyFromPopup(second)
}

function policyHost (addonId) {
  return WebExtensionPolicy.getByID(addonId).mozExtensionHostname
}

function listenForErrors () {
  globalThis.smokeErrors = []
  globalThis.smokeListener = {
    observe (consoleMessage) {
      let message
      try {
        message = consoleMessage.QueryInterface(Components.interfaces.nsIScriptError)
      } catch {
        return
      }
      if (message.flags === 0 && message.sourceName.startsWith('moz-extension://')) {
        globalThis.smokeErrors.push(`${message.sourceName}:${message.lineNumber}: ${message.errorMessage}`)
      }
    }
  }
  Services.console.registerListener(globalThis.smokeListener)
  return true
}

function collectErrors (origin) {
  Services.console.unregisterListener(globalThis.smokeListener)
  return globalThis.smokeErrors.filter(error => error.startsWith(origin))
}

function recordDialogs () {
  window.__smokeDialogs = []
  window.alert = message => { window.__smokeDialogs.push(String(message)) }
  window.confirm = message => {
    window.__smokeDialogs.push(String(message))
    return true
  }
  return true
}

function drainDialogs () {
  return window.__smokeDialogs.splice(0)
}

async function seedStorage (fixture) {
  await browser.storage.local.set(fixture)
  return true
}

async function readStorage () {
  return browser.storage.local.get(null)
}

async function readTabProxies () {
  return (await browser.storage.local.get('tabProxyMap')).tabProxyMap ?? {}
}

async function pingBackground () {
  await browser.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId: 0 })
  return true
}

async function dashboardTabs () {
  return [...document.querySelectorAll('[data-tab]')].map(button => button.dataset.tab)
}

function clickTab (name) {
  document.querySelector(`[data-tab="${name}"]`).click()
}

function removeRow (tableId, index) {
  document.querySelector(`#${tableId} button[data-remove="${index}"]`).click()
}

function importFromUrl (url) {
  document.getElementById('importUrlInput').value = url
  document.getElementById('importUrlBtn').click()
}

function refuseProxySave () {
  document.querySelector('[data-tab="proxy"]').click()
  document.getElementById('addProxy').click()
  document.getElementById('proxyHost').value = 'a:1; PROXY x:8080'
  document.getElementById('proxyPort').value = '8080'
  document.getElementById('saveProxy').click()
}

function proxyHostMarkedInvalid () {
  return document.getElementById('proxyHost').classList.contains('invalid')
}

function popupProxyListReady () {
  return document.querySelectorAll('#proxySelect option').length > 1
}

async function setTabProxy (proxyId) {
  const { id } = await browser.tabs.getCurrent()
  document.getElementById('scopeSelect').value = 'tab'
  document.getElementById('proxySelect').value = proxyId
  document.getElementById('setProxy').click()
  return id
}

let runError = null
process.on('SIGINT', () => closeSession().finally(() => process.exit(130)))
try {
  await runFirefoxSmoke()
} catch (err) {
  runError = err
} finally {
  await closeSession().catch(err => console.error(`shutdown: ${err.message}`))
}

if (runError) failures.push(`run: ${runError.message}`)
if (failures.length) {
  console.error(`FAIL: ${failures.join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`PASS: no uncaught exception or unhandled rejection in any page or the background page; ${dialogs.length} dialog(s) dismissed`)
}
