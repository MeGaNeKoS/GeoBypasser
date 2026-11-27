import { canon, FIXTURE, serveImportFile, SET_ASIDE_EDIT_INDEXES, SET_ASIDE_PROXY, SET_ASIDE_RULE, sleep, STORAGE_WAIT_MS, UI_SETTLE_MS, URL_IMPORT_FILE, waitFor } from './smoke-fixture.mjs'
import { clickSelector, importFromUrl, proxyHostMarkedInvalid, readLocalStorage, refuseProxySave } from './smoke-dashboard.mjs'

function expectedAfterRemoval () {
  return {
    ...FIXTURE,
    rules: FIXTURE.rules.filter((_, i) => i !== SET_ASIDE_RULE),
    proxyList: FIXTURE.proxyList.filter((_, i) => i !== SET_ASIDE_PROXY)
  }
}

export async function editSetAsideEntries (run) {
  for (const index of SET_ASIDE_EDIT_INDEXES) {
    await run(clickSelector, ['[data-tab="proxy"]'])
    await run(clickSelector, [`#proxyTable button[data-edit="${index}"]`])
    await run(clickSelector, ['[data-tab="rules"]'])
    await run(clickSelector, [`#ruleTable button[data-edit="${index}"]`])
  }
  console.log(`clicked Edit on set aside rows ${SET_ASIDE_EDIT_INDEXES.join(', ')} of both tables`)
}

export async function removeSetAsideEntries (run, failures) {
  await run(clickSelector, ['[data-tab="rules"]'])
  await run(clickSelector, [`#ruleTable button[data-remove="${SET_ASIDE_RULE}"]`])
  await run(clickSelector, [`#proxyTable button[data-remove="${SET_ASIDE_PROXY}"]`])
  const expected = expectedAfterRemoval()
  await waitFor(async () => {
    const stored = await run(readLocalStorage)
    return canon(stored.rules) === canon(expected.rules) && canon(stored.proxyList) === canon(expected.proxyList)
  }, STORAGE_WAIT_MS, 'the removal to reach storage.local')
  const stored = await run(readLocalStorage)
  for (const key of Object.keys(FIXTURE)) {
    if (canon(stored[key]) !== canon(expected[key])) failures.push(`storage ${key} differs after removal`)
  }
  console.log(`removed rule row ${SET_ASIDE_RULE} and proxy row ${SET_ASIDE_PROXY}; storage holds every other entry unchanged`)
}

export async function checkUrlImport (run, failures, shownMessages) {
  const importFile = await serveImportFile(JSON.stringify(URL_IMPORT_FILE))
  const shownBefore = (await shownMessages()).length
  try {
    await run(importFromUrl, [importFile.url])
    await waitFor(async () => {
      const stored = await run(readLocalStorage)
      return stored.rules.some(rule => rule?.name === 'url valid rule')
    }, STORAGE_WAIT_MS, 'the URL import to reach storage.local')
  } catch (err) {
    const shown = (await shownMessages()).slice(shownBefore)
    failures.push(`${err.message}; dialogs shown: ${JSON.stringify(shown)}`)
  } finally {
    await importFile.close()
  }
  const imported = await run(readLocalStorage)
  const expected = expectedAfterRemoval()
  if (imported.rules.some(rule => rule?.name === 'url refused rule')) failures.push('storage gained the refused URL import rule')
  if (canon(imported.rules.slice(0, expected.rules.length)) !== canon(expected.rules)) {
    failures.push('storage rules stored before the URL import changed')
  }
  if (!(await shownMessages()).slice(shownBefore).some(message => message.includes('url refused rule'))) {
    failures.push('no message named the refused URL import rule')
  }
  console.log(`URL import from ${importFile.url}: valid rule stored, refused rule not stored, message shown`)
}

export async function checkRefusedProxySave (run, failures) {
  const before = (await run(readLocalStorage)).proxyList
  await run(refuseProxySave)
  await sleep(UI_SETTLE_MS)
  const after = (await run(readLocalStorage)).proxyList
  if (canon(after) !== canon(before)) failures.push('storage proxyList changed after a refused proxy save')
  if (!await run(proxyHostMarkedInvalid)) failures.push('the proxy host field is not marked after a refused proxy save')
  console.log('refused proxy save with host "a:1; PROXY x:8080": storage unchanged, host field marked')
}
