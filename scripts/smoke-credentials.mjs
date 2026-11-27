import { CREDENTIAL_PROXY, runStep, STORAGE_WAIT_MS, UI_SETTLE_MS, sleep, waitFor } from './smoke-fixture.mjs'
import {
  answerProxyDuplicateWithReplace,
  closeOpenSheet,
  captureDownload,
  clickSelector,
  importFile,
  isCheckedSelector,
  isDuplicateModalOpen,
  isProxyDuplicateSheetOpen,
  openNewProxySheet,
  readAttributeSelector,
  readLocalStorage,
  selectProxyRowByHost,
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
const DIAGNOSTICS_INPUT_ATTRIBUTES = [
  { selector: '#diagUser', attribute: 'autocomplete', expected: 'off' },
  { selector: '#diagPass', attribute: 'type', expected: 'password' },
  { selector: '#diagPass', attribute: 'autocomplete', expected: 'new-password' },
]
const PROXY_DUPLICATE_PROMPT = { isOpen: isProxyDuplicateSheetOpen, answer: [answerProxyDuplicateWithReplace, []] }
const CONFIG_DUPLICATE_PROMPT = { isOpen: isDuplicateModalOpen, answer: [clickSelector, ['#duplicateKeepNew']] }

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

async function checkConfigExportLeaveOutControl (run, failures) {
  await run(clickSelector, ['#openExportConfig'])
  if (await run(isCheckedSelector, ['#exportConfigLeaveOutCredentials'])) failures.push('the leave out control is on when the dialog opens')
  const withCredentials = await run(captureDownload, ['#exportConfigConfirm'])
  checkCarriesCredentials('config export with the control off', withCredentials, failures)

  await run(clickSelector, ['#openExportConfig'])
  await run(clickSelector, ['#exportConfigLeaveOutCredentials'])
  const withoutCredentials = await run(captureDownload, ['#exportConfigConfirm'])
  checkOmitsCredentials('config export with the control on', withoutCredentials, failures)

  await run(clickSelector, ['#openExportConfig'])
  if (await run(isCheckedSelector, ['#exportConfigLeaveOutCredentials'])) failures.push('the leave out control stayed on after the dialog reopened')
}

async function checkImportKeepsStoredCredentials (run, failures, { label, inputId, prompt }) {
  await run(importFile, [inputId, JSON.stringify({ proxyList: [IMPORTED_WITHOUT_CREDENTIALS] })])
  try {
    await waitFor(() => run(prompt.isOpen), STORAGE_WAIT_MS, 'the duplicate prompt')
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
  await checkInputAttributes(run, failures, DIAGNOSTICS_INPUT_ATTRIBUTES)
}

export async function checkCredentialWiring (run, failures) {
  const failuresBefore = failures.length
  await runStep('proxies export', () => checkProxiesExportCarriesCredentials(run, failures), failures)
  await runStep('config export leave out control', () => checkConfigExportLeaveOutControl(run, failures), failures)
  await runStep('proxy import', () => checkImportKeepsStoredCredentials(run, failures, { label: 'proxy import', inputId: 'proxyImportInput', prompt: PROXY_DUPLICATE_PROMPT }), failures)
  await runStep('config import', () => checkImportKeepsStoredCredentials(run, failures, { label: 'config import', inputId: 'importConfig', prompt: CONFIG_DUPLICATE_PROMPT }), failures)
  await runStep('credential input attributes', () => checkCredentialInputAttributes(run, failures), failures)
  if (failures.length === failuresBefore) {
    console.log('credentials: Export All, Export Selected, and the default config export carry usernames and passwords, the leave out control is off on open and omits them, proxy and config imports keep stored ones, credential inputs are password fields with the legacy autocomplete values')
  }
}
