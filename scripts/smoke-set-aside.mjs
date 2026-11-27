import { canon, runStep, sleep, STORAGE_WAIT_MS, UI_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { captureDownload, checkEveryConfigExportItem, clickProxyRowAction, clickSelector, countProxyRows, readLocalStorage, saveOpenProxySheetAddress, selectOnlyRuleRowAt, writeLocalStorage } from './smoke-dashboard.mjs'

const NULL_ENTRY_SAVE = { host: 'null-entry.lan', port: 8081 }
const TEXT_ENTRY_SAVE = { host: 'text-entry.lan', port: 8082 }

function indexOfSetAside (proxyList, isSetAside) {
  return proxyList.findIndex(isSetAside)
}

async function saveSetAsideRow (run, index, { host, port }) {
  await run(clickSelector, ['[data-tab="proxy"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickProxyRowAction, [index, 'Edit'])
  await run(saveOpenProxySheetAddress, [host, port])
  await waitFor(async () => (await run(readLocalStorage)).proxyList[index]?.host === host, STORAGE_WAIT_MS, `set aside row ${index} to be saved with ${host}`)
}

function hasCharacterKeys (entry) {
  return Object.keys(entry).some(key => /^\d+$/.test(key))
}

export async function checkSetAsideEditSave (run, failures, reopenDashboard) {
  const before = await run(readLocalStorage)
  const nullIndex = indexOfSetAside(before.proxyList, entry => entry === null)
  const textIndex = indexOfSetAside(before.proxyList, entry => typeof entry === 'string')
  const objectIndex = indexOfSetAside(before.proxyList, entry => entry !== null && typeof entry === 'object' && !entry.id && Object.keys(entry).length === 0)
  await saveSetAsideRow(run, nullIndex, NULL_ENTRY_SAVE)
  await saveSetAsideRow(run, textIndex, TEXT_ENTRY_SAVE)
  const saved = await run(readLocalStorage)
  if (saved.proxyList.length !== before.proxyList.length) failures.push('saving a set aside row changed the number of proxies')
  if (hasCharacterKeys(saved.proxyList[textIndex])) failures.push('the text entry was saved with the characters of its text as keys')
  if (canon(saved.proxyList[objectIndex]) !== canon(before.proxyList[objectIndex])) failures.push('saving neighbouring set aside rows changed the empty object entry')

  await run(clickSelector, ['#fallbackDirect'])
  await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === !before.fallbackDirect, STORAGE_WAIT_MS, 'the unrelated General save to reach storage.local')
  if (canon((await run(readLocalStorage)).proxyList) !== canon(saved.proxyList)) failures.push('an unrelated General save changed the proxy list')

  await reopenDashboard()
  await waitFor(() => run(countProxyRows).then(count => count === before.proxyList.length), STORAGE_WAIT_MS, 'the dashboard to reload with every proxy row')
  if (canon((await run(readLocalStorage)).proxyList) !== canon(saved.proxyList)) failures.push('the set aside saves did not stay in storage across a load')

  await run(writeLocalStorage, [{ proxyList: before.proxyList, fallbackDirect: before.fallbackDirect }])
  await waitFor(async () => canon((await run(readLocalStorage)).proxyList) === canon(before.proxyList), STORAGE_WAIT_MS, 'the set aside rows to be restored')
  console.log(`set aside Edit then Save on the null row ${nullIndex} and the text row ${textIndex}: saved in place, neighbours kept, storage kept across a General save and a reload, then restored`)
}

const SET_ASIDE_EXPORT_INDEXES = [1, 2, 3]
const SET_ASIDE_SKIPPED_INDEXES = [1, 2]

function parseExport (label, text, failures) {
  if (text === null) {
    failures.push(`${label} wrote no file`)
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    failures.push(`${label} wrote text that is not JSON`)
    return null
  }
}

async function checkRowExportsSetAside (run, failures) {
  await run(clickSelector, ['[data-tab="rules"]'])
  await sleep(UI_SETTLE_MS)
  for (const index of SET_ASIDE_EXPORT_INDEXES) {
    await run(selectOnlyRuleRowAt, [index])
    const text = await run(captureDownload, ['#rulesContent', 'Export selected'])
    const parsed = parseExport(`Export on set aside rule row ${index}`, text, failures)
    if (parsed && !Array.isArray(parsed.rules)) failures.push(`Export on set aside rule row ${index} lacks a rule list`)
    if (parsed && SET_ASIDE_SKIPPED_INDEXES.includes(index) && parsed.rules?.length !== 0) {
      failures.push(`Export on set aside rule row ${index} did not write an empty rule list`)
    }
  }
}

async function checkConfigExportEveryRow (run, failures) {
  await run(clickSelector, ['#openExportConfig'])
  await run(checkEveryConfigExportItem)
  const text = await run(captureDownload, ['#exportConfigConfirm'])
  const parsed = parseExport('config export with every row selected', text, failures)
  if (!parsed) return
  if (!Array.isArray(parsed.rules) || !Array.isArray(parsed.proxyList)) {
    failures.push('config export with every row selected lacks a rule or proxy list')
  } else if (parsed.rules.some(rule => typeof rule !== 'object' || rule === null)) {
    failures.push('config export with every row selected wrote a rule that is not an object')
  }
}

export async function checkSetAsideExports (run, failures) {
  const failuresBefore = failures.length
  await runStep('set aside row export', () => checkRowExportsSetAside(run, failures), failures)
  await runStep('config export with every row', () => checkConfigExportEveryRow(run, failures), failures)
  if (failures.length === failuresBefore) {
    console.log('set aside: the row Export writes a rule list and skips non-object rows, and a config export with every row selected writes only object rules')
  }
}
