import { CREDENTIAL_PROXY, runStep, STORAGE_WAIT_MS, waitFor } from './smoke-fixture.mjs'
import {
  captureDownload,
  clickSelector,
  importFile,
  isCheckedSelector,
  isDuplicateModalOpen,
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
const CREDENTIAL_INPUT_ATTRIBUTES = [
  { selector: '#proxyUser', attribute: 'autocomplete', expected: 'off' },
  { selector: '#proxyPass', attribute: 'type', expected: 'password' },
  { selector: '#proxyPass', attribute: 'autocomplete', expected: 'new-password' },
  { selector: '#diagUser', attribute: 'autocomplete', expected: 'off' },
  { selector: '#diagPass', attribute: 'type', expected: 'password' },
  { selector: '#diagPass', attribute: 'autocomplete', expected: 'new-password' },
]

function checkNoCredentials (label, text, failures) {
  if (text === null) {
    failures.push(`${label} wrote no file`)
    return
  }
  if (CREDENTIAL_TEXTS.some(credential => text.includes(credential))) {
    failures.push(`${label} wrote a credential`)
  }
}

async function checkProxiesExportOmits (run, failures) {
  const text = await run(captureDownload, ['#exportProxiesAll'])
  checkNoCredentials('Export All', text, failures)
  if (text !== null && !text.includes(CREDENTIAL_PROXY.host)) failures.push('Export All did not write the credentials proxy')

  await run(selectProxyRowByHost, [CREDENTIAL_PROXY.host])
  const selected = await run(captureDownload, ['#exportProxiesSelected'])
  checkNoCredentials('Export Selected', selected, failures)
  if (selected !== null && !selected.includes(CREDENTIAL_PROXY.host)) failures.push('Export Selected did not write the selected proxy')
}

async function checkConfigExportControl (run, failures) {
  await run(clickSelector, ['#openExportConfig'])
  if (await run(isCheckedSelector, ['#exportConfigCredentials'])) failures.push('the config export control is on when the dialog opens')
  await run(clickSelector, ['#exportConfigCredentials'])
  const withCredentials = await run(captureDownload, ['#exportConfigConfirm'])
  if (withCredentials === null || !withCredentials.includes(CREDENTIAL_PROXY.password)) {
    failures.push('config export with the control on left out the credentials')
  }

  await run(clickSelector, ['#openExportConfig'])
  if (await run(isCheckedSelector, ['#exportConfigCredentials'])) failures.push('the config export control stayed on after the dialog reopened')
  const withoutCredentials = await run(captureDownload, ['#exportConfigConfirm'])
  checkNoCredentials('config export with the control off', withoutCredentials, failures)
}

async function checkImportKeepsStoredCredentials (run, failures, { label, inputId }) {
  await run(importFile, [inputId, JSON.stringify({ proxyList: [IMPORTED_WITHOUT_CREDENTIALS] })])
  try {
    await waitFor(() => run(isDuplicateModalOpen), STORAGE_WAIT_MS, 'the duplicate proxy prompt')
    await run(clickSelector, ['#duplicateKeepNew'])
    await waitFor(async () => {
      const stored = await run(readLocalStorage)
      const copies = stored.proxyList.filter(entry => entry?.id === CREDENTIAL_PROXY.id)
      return copies.length > 0 && copies.every(proxy => proxy.username === CREDENTIAL_PROXY.username && proxy.password === CREDENTIAL_PROXY.password)
    }, STORAGE_WAIT_MS, 'the imported proxy to keep its stored credentials')
  } catch (err) {
    failures.push(`${label} without credentials: ${err.message}`)
  }
}

async function checkCredentialInputAttributes (run, failures) {
  for (const { selector, attribute, expected } of CREDENTIAL_INPUT_ATTRIBUTES) {
    const actual = await run(readAttributeSelector, [selector, attribute])
    if (actual !== expected) failures.push(`${selector} ${attribute} is ${actual}, expected ${expected}`)
  }
}

export async function checkCredentialWiring (run, failures) {
  const failuresBefore = failures.length
  await runStep('proxies export', () => checkProxiesExportOmits(run, failures), failures)
  await runStep('config export control', () => checkConfigExportControl(run, failures), failures)
  await runStep('proxy import', () => checkImportKeepsStoredCredentials(run, failures, { label: 'proxy import', inputId: 'importProxies' }), failures)
  await runStep('config import', () => checkImportKeepsStoredCredentials(run, failures, { label: 'config import', inputId: 'importConfig' }), failures)
  await runStep('credential input attributes', () => checkCredentialInputAttributes(run, failures), failures)
  if (failures.length === failuresBefore) {
    console.log('credentials: Export All and Export Selected omit them, the config export control is off on open, proxy and config imports keep stored ones, credential inputs are password and autofill-free')
  }
}
