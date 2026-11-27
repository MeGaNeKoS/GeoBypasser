import { CREDENTIAL_PROXY, waitFor } from './smoke-fixture.mjs'

const STEP_TIMEOUT_MS = 10000
const CREDENTIAL_TEXTS = [CREDENTIAL_PROXY.username, CREDENTIAL_PROXY.password]
const IMPORTED_WITHOUT_CREDENTIALS = {
  id: CREDENTIAL_PROXY.id,
  type: CREDENTIAL_PROXY.type,
  proxyDNS: false,
  host: CREDENTIAL_PROXY.host,
  port: CREDENTIAL_PROXY.port
}

export function captureDownload (buttonId) {
  const realCreateObjectURL = URL.createObjectURL
  const realAnchorClick = HTMLAnchorElement.prototype.click
  let blob = null
  URL.createObjectURL = captured => {
    blob = captured
    return 'blob:smoke'
  }
  HTMLAnchorElement.prototype.click = function () {}
  try {
    document.getElementById(buttonId).click()
  } finally {
    URL.createObjectURL = realCreateObjectURL
    HTMLAnchorElement.prototype.click = realAnchorClick
  }
  return blob ? blob.text() : null
}

export function clickById (id) {
  document.getElementById(id).click()
}

export function isChecked (id) {
  return document.getElementById(id).checked
}

export function isDuplicateModalOpen () {
  return !document.getElementById('duplicateModal').classList.contains('hidden')
}

export function importProxyFile (text) {
  const input = document.getElementById('importProxies')
  const transfer = new DataTransfer()
  transfer.items.add(new File([text], 'proxies.json', { type: 'application/json' }))
  input.files = transfer.files
  input.dispatchEvent(new Event('change'))
}

export function readLocalStorage () {
  return (globalThis.browser ?? globalThis.chrome).storage.local.get(null)
}

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
  const text = await run(captureDownload, ['exportProxiesAll'])
  checkNoCredentials('Export All', text, failures)
  if (text !== null && !text.includes(CREDENTIAL_PROXY.host)) failures.push('Export All did not write the credentials proxy')
}

async function checkConfigExportControl (run, failures) {
  await run(clickById, ['openExportConfig'])
  if (await run(isChecked, ['exportConfigCredentials'])) failures.push('the config export control is on when the dialog opens')
  await run(clickById, ['exportConfigCredentials'])
  const withCredentials = await run(captureDownload, ['exportConfigConfirm'])
  if (withCredentials === null || !withCredentials.includes(CREDENTIAL_PROXY.password)) {
    failures.push('config export with the control on left out the credentials')
  }

  await run(clickById, ['openExportConfig'])
  if (await run(isChecked, ['exportConfigCredentials'])) failures.push('the config export control stayed on after the dialog reopened')
  const withoutCredentials = await run(captureDownload, ['exportConfigConfirm'])
  checkNoCredentials('config export with the control off', withoutCredentials, failures)
}

async function checkImportKeepsStoredCredentials (run, failures) {
  await run(importProxyFile, [JSON.stringify({ proxyList: [IMPORTED_WITHOUT_CREDENTIALS] })])
  try {
    await waitFor(() => run(isDuplicateModalOpen), STEP_TIMEOUT_MS, 'the duplicate proxy prompt')
    await run(clickById, ['duplicateKeepNew'])
    await waitFor(async () => {
      const stored = await run(readLocalStorage)
      const proxy = stored.proxyList.find(entry => entry?.id === CREDENTIAL_PROXY.id)
      return proxy?.username === CREDENTIAL_PROXY.username && proxy?.password === CREDENTIAL_PROXY.password
    }, STEP_TIMEOUT_MS, 'the imported proxy to keep its stored credentials')
  } catch (err) {
    failures.push(`import without credentials: ${err.message}`)
  }
}

async function runStep (name, step, failures) {
  try {
    await step()
  } catch (err) {
    failures.push(`${name}: ${err.message}`)
  }
}

export async function checkCredentialWiring (run, failures) {
  await runStep('proxies export', () => checkProxiesExportOmits(run, failures), failures)
  await runStep('config export control', () => checkConfigExportControl(run, failures), failures)
  await runStep('import', () => checkImportKeepsStoredCredentials(run, failures), failures)
  console.log('credentials: Export All omits them, the config export control is off on open, an import keeps stored ones')
}
