import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXTURE, POPUP_SETTLE_MS, runStep, sleep, STEP_TIMEOUT_MS, STOP_GRACE_MS, STORAGE_WAIT_MS, TAB_SETTLE_MS, UI_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { connectOnce, MarionetteClient } from './smoke-marionette.mjs'
import { checkCredentialWiring } from './smoke-credentials.mjs'
import { checkRevealAndRowExport, checkSetAsideEditSave, checkSetAsideExports, checkSetAsideOnlyAndFocus } from './smoke-set-aside.mjs'
import { checkMixedOverrideInDashboard, addProxyAsDefault, clickSiteClearInPopup, MIXED_HOST, MIXED_KEY, MIXED_URL, mixedRouteProxy, openPopupBesideTab, readPopupDomain, storedKeysForHost, tabLoadStatus, writeMixedOverride } from './smoke-override-spelling.mjs'
import { checkNetworkStatsNames, FIREFOX_NETWORK_SCENARIO } from './smoke-network-stats.mjs'
import { startRecordingListener } from './smoke-chrome-route.mjs'
import { checkRuleFlipFromPopup } from './smoke-popup-rules.mjs'
import { checkHomeCase, FIRST_TIME_CASE, readHomeState, SET_UP_CASE } from './smoke-home.mjs'
import { COMPONENT_TEST_PAGE, firefoxKeyActions, runComponentTestPage } from './smoke-component-test.mjs'
import { PROTOTYPE_PAGES, missingStylesheets, prototypeProblems, prototypeUrl, readPrototypeState } from './smoke-prototype.mjs'
import { checkSectionImportsThroughReview } from './smoke-review-imports.mjs'
import { checkProxyEditSurvivesRuleSave, checkRefusedProxySave, checkRuleAddEditDelete, checkKeepAliveAddEditDelete, checkRuleRowsAfterReread, checkSiteAddEditDelete, checkUrlImport, editSetAsideEntries, removeSetAsideEntries } from './smoke-assertions.mjs'
import { checkSettingChanges } from './smoke-setting-changes.mjs'
import { checkAboutDescription, checkDefaultReadBack, checkTestAgainstListener } from './smoke-sections.mjs'
import { clickSelector } from './smoke-dashboard.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, '.chrome-cdp-work')
const PROFILE = join(WORK, 'firefox-profile')
const SMOKE_DIST = join(WORK, 'firefox-smoke-dist')
const SMOKE_ADDON_ID = 'geobypass-smoke@localhost'
const DEFAULT_FIREFOX_PATH = 'C:/Program Files/Mozilla Firefox/firefox.exe'
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

function readSettings (argv, env) {
  return {
    dist: resolve(argv[2] ?? join(ROOT, 'dist')),
    firefoxPath: env.SMOKE_FIREFOX_PATH ?? DEFAULT_FIREFOX_PATH,
    env: { ...env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' }
  }
}

function freePort () {
  return new Promise((done, reject) => {
    const server = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}

function requireFirefoxManifest (dist) {
  const manifestFile = join(dist, 'manifest.json')
  if (!existsSync(manifestFile)) throw new Error(`no extension manifest in ${dist}`)
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  if (!manifest.browser_specific_settings?.gecko) {
    throw new Error(`${dist} is not a Firefox build: its manifest has no browser_specific_settings.gecko`)
  }
}

function prepareSmokeDist (dist) {
  requireFirefoxManifest(dist)
  rmSync(SMOKE_DIST, { recursive: true, force: true })
  cpSync(dist, SMOKE_DIST, { recursive: true })
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

function launchFirefox (port, settings) {
  writePrefs(port)
  const log = openSync(join(PROFILE, 'firefox.log'), 'a')
  firefox = spawn(settings.firefoxPath, ['-no-remote', '-profile', PROFILE, '--marionette', 'about:blank'], {
    stdio: ['ignore', log, log],
    env: settings.env
  })
  exited = new Promise(done => firefox.on('exit', done))
}

const wrap = fn => `const done = arguments[arguments.length - 1];
Promise.resolve().then(() => (${fn.toString()})(...Array.prototype.slice.call(arguments, 0, -1)))
  .then(value => done({ ok: true, value }), error => done({ ok: false, error: error && error.message !== undefined ? error.message + ' @ ' + error.stack : String(error) }))`

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

async function openSession (settings) {
  const port = await freePort()
  launchFirefox(port, settings)
  const socket = await waitFor(() => connectOnce(port), STEP_TIMEOUT_MS, 'the Marionette port')
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
    await Promise.race([exited, sleep(STOP_GRACE_MS)])
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
  await waitFor(() => evaluate(pingBackground), STEP_TIMEOUT_MS, 'the background to answer in the second session')
  console.log('background answered in the second session, after a restart with the stored config')
}

async function visitDashboardTabs () {
  const tabs = await evaluate(dashboardTabs)
  if (!tabs.includes('override')) failures.push('dashboard has no website overrides tab')
  for (const tab of tabs) {
    await evaluate(clickSelector, [`[data-tab="${tab}"]`])
    await sleep(TAB_SETTLE_MS)
  }
  console.log(`dashboard tabs visited: ${tabs.join(', ')}`)
}

async function openMixedTabInOwnWindow (listenerPort) {
  const route = mixedRouteProxy(listenerPort)
  await evaluate(addProxyAsDefault, [route])
  await evaluate(writeMixedOverride, [MIXED_KEY, route.id])
  await sleep(UI_SETTLE_MS)
  await takeDialogs()
  recording = false
  const { handle } = await marionette.send('WebDriver:NewWindow', { type: 'window' })
  await marionette.send('WebDriver:SwitchToWindow', { handle, focus: true })
  await navigate(MIXED_URL)
}

async function openPopupBesideMixedTab (session, dashboardHandle) {
  await takeDialogs()
  recording = false
  await marionette.send('WebDriver:SwitchToWindow', { handle: dashboardHandle, focus: true })
  const before = await marionette.send('WebDriver:GetWindowHandles')
  const popupTabId = await evaluate(openPopupBesideTab, [MIXED_URL, `${session.origin}popup.html`])
  await waitFor(() => evaluate(tabLoadStatus, [popupTabId]).then(status => status === 'complete'), STEP_TIMEOUT_MS, 'the popup tab to load beside the mixed tab')
  await sleep(POPUP_SETTLE_MS)
  const after = await marionette.send('WebDriver:GetWindowHandles')
  const popupHandle = after.find(handle => !before.includes(handle))
  if (!popupHandle) throw new Error('no new window handle after opening the popup beside the mixed tab')
  await marionette.send('WebDriver:SwitchToWindow', { handle: popupHandle, focus: true })
  await waitFor(() => evaluate(popupProxyListReady), STEP_TIMEOUT_MS, 'the popup opened beside the mixed tab')
}

async function clearMixedOverrideFromPopup () {
  const domain = await evaluate(readPopupDomain)
  if (domain !== MIXED_HOST) throw new Error(`the popup reads the domain ${domain}, not ${MIXED_HOST}`)
  await evaluate(clickSiteClearInPopup)
  await waitFor(async () => (await evaluate(storedKeysForHost, [MIXED_HOST])).length === 0, STORAGE_WAIT_MS, 'the popup clear to reach storage.local')
}

async function checkPopupClearOnMixedTab (session) {
  const listener = await startRecordingListener()
  try {
    const dashboardHandle = (await marionette.send('WebDriver:GetWindowHandle')).value
    await openMixedTabInOwnWindow(listener.port)
    await openPopupBesideMixedTab(session, dashboardHandle)
    await clearMixedOverrideFromPopup()
    await marionette.send('WebDriver:SwitchToWindow', { handle: dashboardHandle, focus: true })
    console.log(`popup beside ${MIXED_URL} cleared "${MIXED_KEY}" with site scope; storage holds no case variant of ${MIXED_HOST}`)
  } finally {
    listener.server.closeAllConnections()
    await new Promise(done => listener.server.close(done))
  }
}

async function setTabProxyFromPopup (session) {
  await takeDialogs()
  recording = false
  const { handle } = await marionette.send('WebDriver:NewWindow', { type: 'tab' })
  await marionette.send('WebDriver:SwitchToWindow', { handle, focus: true })
  await navigate(`${session.origin}popup.html`)
  await waitFor(() => evaluate(popupProxyListReady), STEP_TIMEOUT_MS, 'the popup proxy list in its own tab')
  const tabId = await evaluate(setTabProxy, ['proxy-good'])
  await waitFor(async () => (await evaluate(readTabProxies))[tabId] === 'proxy-good', STORAGE_WAIT_MS, 'the tab proxy to reach storage.local')
  console.log(`popup set tab ${tabId} to proxy-good; tabProxyMap holds it`)
}

async function openDashboardWindow () {
  const callerHandle = (await marionette.send('WebDriver:GetWindowHandle')).value
  const { handle } = await marionette.send('WebDriver:NewWindow', { type: 'tab' })
  const inWindow = async action => {
    await marionette.send('WebDriver:SwitchToWindow', { handle, focus: true })
    try {
      return await action()
    } finally {
      await marionette.send('WebDriver:SwitchToWindow', { handle: callerHandle, focus: true })
    }
  }
  await inWindow(() => marionette.send('WebDriver:Navigate', { url: `${sessionOrigin}dashboard.html` }))
  return {
    run: (fn, args) => inWindow(() => evaluate(fn, args)),
    close: async () => {
      await marionette.send('WebDriver:SwitchToWindow', { handle, focus: true })
      await marionette.send('WebDriver:CloseWindow', {})
      await marionette.send('WebDriver:SwitchToWindow', { handle: callerHandle, focus: true })
    },
  }
}

async function runFirefoxSmoke (settings) {
  prepareSmokeDist(settings.dist)
  resetProfile()

  const first = await openSession(settings)
  await navigate(`${first.origin}dashboard.html`)
  await checkHomeCase(() => evaluate(readHomeState), FIRST_TIME_CASE, failures)
  await seedFixture(first)
  await closeSession()

  const second = await openSession(settings)
  await checkStartupFromStorage(second)
  await checkHomeCase(() => evaluate(readHomeState), SET_UP_CASE, failures)
  await visitDashboardTabs()
  await removeSetAsideEntries(evaluate, failures)
  await editSetAsideEntries(evaluate)
  await checkUrlImport(evaluate, failures)
  await checkSettingChanges(evaluate, failures)
  await checkRefusedProxySave(evaluate, failures)
  await checkCredentialWiring(evaluate, failures)
  await checkProxyEditSurvivesRuleSave(evaluate, failures)
  await checkRuleRowsAfterReread(evaluate, failures)
  await checkRuleAddEditDelete(evaluate, failures)
  await checkSiteAddEditDelete(evaluate, failures)
  await checkKeepAliveAddEditDelete(evaluate, failures)
  await checkSectionImportsThroughReview(evaluate, failures)
  await checkSetAsideEditSave(evaluate, failures, () => navigate(`${sessionOrigin}dashboard.html#proxies`))
  await checkSetAsideExports(evaluate, failures)
  await checkSetAsideOnlyAndFocus(evaluate, failures)
  await checkRevealAndRowExport(evaluate, failures)
  const networkWindow = await openDashboardWindow()
  try {
    await checkNetworkStatsNames(networkWindow.run, failures, FIREFOX_NETWORK_SCENARIO, openDashboardWindow)
  } finally {
    await networkWindow.close()
  }
  await checkDefaultReadBack(evaluate, failures)
  await checkTestAgainstListener(evaluate, failures)
  await checkAboutDescription(evaluate, 'firefox', failures)
  await checkMixedOverrideInDashboard({ run: evaluate, reopenDashboard: () => navigate(`${second.origin}dashboard.html`) }, failures)
  await runStep('popup clears a mixed case override for the tab it is opened beside', () => checkPopupClearOnMixedTab(second), failures)
  await setTabProxyFromPopup(second)
  await checkRuleFlipFromPopup(evaluate, failures)
  await checkComponentTestPage(second)
  await checkPrototypePages()
}

async function checkComponentTestPage (session) {
  await navigate(`${session.origin}${COMPONENT_TEST_PAGE}`)
  const componentFailures = await runComponentTestPage(componentDriver())
  failures.push(...componentFailures.map(message => `component test: ${message}`))
  console.log(`component test page: ${componentFailures.length} failure(s)`)
}

async function checkPrototypePages () {
  for (const page of PROTOTYPE_PAGES) {
    await navigate(prototypeUrl(page))
    const state = await evaluate(readPrototypeState)
    failures.push(...prototypeProblems(page, state, missingStylesheets(page)))
    console.log(`prototype ${page}: ${JSON.stringify(state)}`)
  }
}

function componentDriver () {
  return {
    read: fn => evaluate(fn),
    write: (fn, args) => evaluate(fn, args),
    press: async step => {
      await marionette.send('Marionette:SetContext', { value: 'content' })
      const handle = (await marionette.send('WebDriver:GetWindowHandle')).value
      await marionette.send('WebDriver:SwitchToWindow', { handle, focus: true })
      await marionette.send('WebDriver:PerformActions', { actions: [{ type: 'key', id: 'keyboard', actions: firefoxKeyActions(step) }] })
      await marionette.send('WebDriver:ReleaseActions', {})
    },
    setScheme: scheme => evaluate(setContentScheme, [CONTENT_SCHEME_OVERRIDE[scheme]], 'chrome'),
    reload: async () => {
      await marionette.send('Marionette:SetContext', { value: 'content' })
      await marionette.send('WebDriver:Refresh', {})
      await evaluate(recordDialogs)
    },
  }
}

const CONTENT_SCHEME_OVERRIDE = { dark: 0, light: 1 }

function setContentScheme (override) {
  Services.prefs.setIntPref('layout.css.prefers-color-scheme.content-override', override)
  return true
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
      if (message.flags === 0 && (message.sourceName.startsWith('moz-extension://') || message.sourceName.startsWith('file://'))) {
        globalThis.smokeErrors.push(`${message.sourceName}:${message.lineNumber}: ${message.errorMessage}`)
      }
    }
  }
  Services.console.registerListener(globalThis.smokeListener)
  return true
}

function collectErrors (origin) {
  Services.console.unregisterListener(globalThis.smokeListener)
  return globalThis.smokeErrors.filter(error => error.startsWith(origin) || error.startsWith('file://'))
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

function popupProxyListReady () {
  return document.querySelectorAll('#proxySelect option').length > 1
}

async function setTabProxy (proxyId) {
  const { id } = await browser.tabs.getCurrent()
  document.querySelector('input[name="scope"][value="tab"]').click()
  const select = document.getElementById('proxySelect')
  select.value = proxyId
  select.dispatchEvent(new Event('change'))
  document.querySelector('[data-focus-key="set-proxy"]').click()
  return id
}

async function main () {
  const settings = readSettings(process.argv, process.env)
  let runError = null
  process.on('SIGINT', () => closeSession().finally(() => process.exit(130)))
  try {
    await runFirefoxSmoke(settings)
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
}

await main()
