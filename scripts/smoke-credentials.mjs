import { CREDENTIAL_PROXY, runStep, STORAGE_WAIT_MS, UI_SETTLE_MS, sleep, waitFor } from './smoke-fixture.mjs'
import {
  answerReviewWithReplace,
  closeOpenSheet,
  captureDownload,
  clickSelector,
  importFile,
  isReviewSheetOpen,
  openNewProxySheet,
  readAttributeSelector,
  readLocalStorage,
  selectProxyRowByHost,
  showTestSection,
} from './smoke-dashboard.mjs'

const CREDENTIAL_TEXTS = [CREDENTIAL_PROXY.username, CREDENTIAL_PROXY.password]
const IMPORTED_WITHOUT_CREDENTIALS = {
  id: CREDENTIAL_PROXY.id,
  type: CREDENTIAL_PROXY.type,
  proxyDNS: false,
  host: CREDENTIAL_PROXY.host,
  port: CREDENTIAL_PROXY.port
}
const PROXY_SHEET_INPUT_ATTRIBUTES = [
  { selector: 'input[name="username"]', attribute: 'autocomplete', expected: 'off' },
  { selector: 'input[name="password"]', attribute: 'type', expected: 'password' },
  { selector: 'input[name="password"]', attribute: 'autocomplete', expected: 'new-password' },
]
const TEST_INPUT_ATTRIBUTES = [
  { selector: 'input[name="testUsername"]', attribute: 'autocomplete', expected: 'off' },
  { selector: 'input[name="testPassword"]', attribute: 'type', expected: 'password' },
  { selector: 'input[name="testPassword"]', attribute: 'autocomplete', expected: 'new-password' },
]
const PROXY_REVIEW_PROMPT = { isOpen: isReviewSheetOpen, answer: [answerReviewWithReplace, []] }
const EXPORT_BUTTON_SELECTOR = '[data-focus-key="export-config"]'
const EXPORT_SHEET_SELECTOR = 'dialog.sheet'
const EXPORT_SHEET_SAVE_LABEL = 'Export'
const LEAVE_OUT_SWITCH_SELECTOR = '[role="switch"][data-field="leaveOutCredentials"]'

function checkCarriesCredentials (label, text, failures) {
  if (text === null) {
    failures.push(`${label} wrote no file`)
    return
  }
  if (CREDENTIAL_TEXTS.some(credential => !text.includes(credential))) {
    failures.push(`${label} left out a credential`)
  }
}

function checkOmitsCredentials (label, text, failures) {
  if (text === null) {
    failures.push(`${label} wrote no file`)
    return
  }
  if (CREDENTIAL_TEXTS.some(credential => text.includes(credential))) {
    failures.push(`${label} wrote a credential`)
  }
}

async function checkProxiesExportCarriesCredentials (run, failures) {
  const text = await run(captureDownload, ['#proxyContent', 'Export all'])
  checkCarriesCredentials('Export All', text, failures)
  if (text !== null && !text.includes(CREDENTIAL_PROXY.host)) failures.push('Export All did not write the credentials proxy')

  await run(selectProxyRowByHost, [CREDENTIAL_PROXY.host])
  const selected = await run(captureDownload, ['#proxyContent', 'Export selected'])
  checkCarriesCredentials('Export Selected', selected, failures)
  if (selected !== null && !selected.includes(CREDENTIAL_PROXY.host)) failures.push('Export Selected did not write the selected proxy')
}

function configExportSheetReady () {
  return document.querySelector('dialog.sheet[open] [role="switch"][data-field="leaveOutCredentials"]') !== null
    && Array.from(document.querySelectorAll('dialog.sheet[open] button')).some(button => button.textContent.trim() === 'Export')
}

async function openConfigExportSheet (run) {
  await run(clickSelector, ['[data-tab="impexp"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickSelector, [EXPORT_BUTTON_SELECTOR])
  await waitFor(() => run(configExportSheetReady), STORAGE_WAIT_MS, 'the config export sheet fields to render')
}

async function checkLeaveOutStateIsOff (run, failures, when) {
  if (await run(readAttributeSelector, [LEAVE_OUT_SWITCH_SELECTOR, 'aria-checked']) !== 'false') failures.push(`the leave out control is on ${when}`)
}

async function checkConfigExportLeaveOutControl (run, failures) {
  await openConfigExportSheet(run)
  await checkLeaveOutStateIsOff(run, failures, 'when the sheet opens')
  const withCredentials = await run(captureDownload, [EXPORT_SHEET_SELECTOR, EXPORT_SHEET_SAVE_LABEL])
  checkCarriesCredentials('config export with the control off', withCredentials, failures)

  await openConfigExportSheet(run)
  await run(clickSelector, [LEAVE_OUT_SWITCH_SELECTOR])
  const withoutCredentials = await run(captureDownload, [EXPORT_SHEET_SELECTOR, EXPORT_SHEET_SAVE_LABEL])
  checkOmitsCredentials('config export with the control on', withoutCredentials, failures)

  await openConfigExportSheet(run)
  await checkLeaveOutStateIsOff(run, failures, 'after the sheet reopened')
  await run(closeOpenSheet)
}

async function checkImportKeepsStoredCredentials (run, failures, { label, inputId, prompt }) {
  await run(importFile, [inputId, JSON.stringify({ proxyList: [IMPORTED_WITHOUT_CREDENTIALS] })])
  try {
    await waitFor(() => run(prompt.isOpen), STORAGE_WAIT_MS, 'the import prompt')
    await run(...prompt.answer)
    await waitFor(async () => {
      const stored = await run(readLocalStorage)
      const copies = stored.proxyList.filter(entry => entry?.id === CREDENTIAL_PROXY.id)
      return copies.length > 0 && copies.every(proxy => proxy.username === CREDENTIAL_PROXY.username && proxy.password === CREDENTIAL_PROXY.password)
    }, STORAGE_WAIT_MS, 'the imported proxy to keep its stored credentials')
  } catch (err) {
    failures.push(`${label} without credentials: ${err.message}`)
  }
}

async function checkConfigImportKeepsStoredCredentials (run, failures) {
  await run(clickSelector, ['[data-tab="impexp"]'])
  await sleep(UI_SETTLE_MS)
  await checkImportKeepsStoredCredentials(run, failures, { label: 'config import', inputId: 'configImportInput', prompt: PROXY_REVIEW_PROMPT })
}

async function checkInputAttributes (run, failures, attributes) {
  for (const { selector, attribute, expected } of attributes) {
    const actual = await run(readAttributeSelector, [selector, attribute])
    if (actual !== expected) failures.push(`${selector} ${attribute} is ${actual}, expected ${expected}`)
  }
}

async function checkCredentialInputAttributes (run, failures) {
  await run(openNewProxySheet)
  await sleep(UI_SETTLE_MS)
  await checkInputAttributes(run, failures, PROXY_SHEET_INPUT_ATTRIBUTES)
  await run(closeOpenSheet)
  await run(showTestSection)
  await sleep(UI_SETTLE_MS)
  await checkInputAttributes(run, failures, TEST_INPUT_ATTRIBUTES)
}

export async function checkCredentialWiring (run, failures) {
  const failuresBefore = failures.length
  await runStep('proxies export', () => checkProxiesExportCarriesCredentials(run, failures), failures)
  await runStep('config export leave out control', () => checkConfigExportLeaveOutControl(run, failures), failures)
  await runStep('proxy import', () => checkImportKeepsStoredCredentials(run, failures, { label: 'proxy import', inputId: 'proxyImportInput', prompt: PROXY_REVIEW_PROMPT }), failures)
  await runStep('config import', () => checkConfigImportKeepsStoredCredentials(run, failures), failures)
  await runStep('credential input attributes', () => checkCredentialInputAttributes(run, failures), failures)
  if (failures.length === failuresBefore) {
    console.log('credentials: Export All, Export Selected, and the default config export carry usernames and passwords, the leave out control is off on open and omits them, proxy and config imports keep stored ones, credential inputs are password fields with the legacy autocomplete values')
  }
}
