import { canon, FIXTURE, serveImportFile, SET_ASIDE_EDIT_INDEXES, SET_ASIDE_PROXY, SET_ASIDE_RULE, sleep, STORAGE_WAIT_MS, UI_SETTLE_MS, URL_IMPORT_FILE, waitFor } from './smoke-fixture.mjs'
import { clickKeepAliveActiveFor, clickProxyRowAction, clickSelector, closeOpenSheet, confirmInlineDelete, importFromUrl, proxyHostMarkedInvalid, readLocalStorage, refuseProxySave, ruleSelectionState, saveOpenProxySheetLabel, writeLocalStorage } from './smoke-dashboard.mjs'

const PROXY_LABEL_AFTER_EDIT = 'edited in proxies'

async function setFirstProxyLabel (run, label) {
  await run(clickSelector, ['[data-tab="proxy"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickProxyRowAction, [0, 'Edit'])
  await run(saveOpenProxySheetLabel, [label])
  await waitFor(async () => (await run(readLocalStorage)).proxyList[0]?.label === label, STORAGE_WAIT_MS, `the first proxy label ${label} to reach storage.local`)
}

export async function checkProxyEditSurvivesRuleSave (run, failures) {
  const failuresBefore = failures.length
  const originalLabel = FIXTURE.proxyList[0].label
  await setFirstProxyLabel(run, PROXY_LABEL_AFTER_EDIT)
  await run(clickSelector, ['[data-tab="rules"]'])
  await sleep(UI_SETTLE_MS)
  const ruleActiveBefore = (await run(readLocalStorage)).rules[0].active
  await run(clickSelector, ['#ruleTable input[data-active]'])
  await waitFor(async () => (await run(readLocalStorage)).rules[0].active !== ruleActiveBefore, STORAGE_WAIT_MS, 'the rule save to reach storage.local')
  if ((await run(readLocalStorage)).proxyList[0]?.label !== PROXY_LABEL_AFTER_EDIT) failures.push('a proxy edit in the proxies section was reverted by a later rule save')
  await run(clickSelector, ['#ruleTable input[data-active]'])
  await waitFor(async () => (await run(readLocalStorage)).rules[0].active === ruleActiveBefore, STORAGE_WAIT_MS, 'the rule to be restored')
  await setFirstProxyLabel(run, originalLabel)
  if (failures.length === failuresBefore) {
    console.log('proxy label edited in the proxies section survived a later rule save and was restored')
  }
}

export async function checkLegacyRowsAfterReread (run, failures) {
  const originalLabel = FIXTURE.proxyList[0].label
  await setFirstProxyLabel(run, PROXY_LABEL_AFTER_EDIT)
  const before = await run(readLocalStorage)

  await run(clickSelector, ['[data-tab="keepalive"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickKeepAliveActiveFor, ['proxy-good'])
  await waitFor(async () => (await run(readLocalStorage)).keepAliveRules['proxy-good']?.active === false, STORAGE_WAIT_MS, 'the keep-alive toggle to reach storage.local')
  await run(clickKeepAliveActiveFor, ['proxy-good'])
  await waitFor(async () => (await run(readLocalStorage)).keepAliveRules['proxy-good']?.active === true, STORAGE_WAIT_MS, 'the keep-alive toggle back to reach storage.local')

  await run(clickSelector, ['[data-tab="rules"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickSelector, ['#ruleTable input[data-select="0"]'])
  await run(writeLocalStorage, [{ fallbackDirect: !before.fallbackDirect }])
  await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === !before.fallbackDirect, STORAGE_WAIT_MS, 'the outside save to reach storage.local')
  await sleep(UI_SETTLE_MS)
  const selection = await run(ruleSelectionState)
  if (selection.checked > 0 || selection.deleteShown) failures.push('an outside save left a rule selected')
  await run(clickSelector, ['#deleteRulesSelected'])
  await sleep(UI_SETTLE_MS)
  if (canon((await run(readLocalStorage)).rules) !== canon(before.rules)) failures.push('Delete selected after an outside save deleted a rule')
  await run(writeLocalStorage, [{ fallbackDirect: before.fallbackDirect }])
  await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === before.fallbackDirect, STORAGE_WAIT_MS, 'the outside save to be restored')

  await run(clickSelector, ['#ruleTable button[data-remove="0"]'])
  await waitFor(async () => canon((await run(readLocalStorage)).rules) === canon(before.rules.slice(1)), STORAGE_WAIT_MS, 'the legacy rule delete to reach storage.local')
  if ((await run(readLocalStorage)).proxyList[0]?.label !== PROXY_LABEL_AFTER_EDIT) failures.push('a legacy rule delete reverted the proxy edit made in the proxies section')

  await run(writeLocalStorage, [{ rules: before.rules }])
  await waitFor(async () => canon((await run(readLocalStorage)).rules) === canon(before.rules), STORAGE_WAIT_MS, 'the deleted rule to be restored')
  await setFirstProxyLabel(run, originalLabel)
  console.log('legacy keep-alive toggle, rule selection cleared by an outside save, and rule delete after a proxy edit and storage re-read: all held, the proxy edit survived, then restored')
}

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
    await sleep(UI_SETTLE_MS)
    await run(clickProxyRowAction, [index, 'Edit'])
    await run(closeOpenSheet)
    await run(clickSelector, ['[data-tab="rules"]'])
    await run(clickSelector, [`#ruleTable button[data-edit="${index}"]`])
  }
  console.log(`clicked Edit on set aside rows ${SET_ASIDE_EDIT_INDEXES.join(', ')} of both tables`)
}

export async function removeSetAsideEntries (run, failures) {
  await run(clickSelector, ['[data-tab="rules"]'])
  await run(clickSelector, [`#ruleTable button[data-remove="${SET_ASIDE_RULE}"]`])
  await run(clickSelector, ['[data-tab="proxy"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickProxyRowAction, [SET_ASIDE_PROXY, 'Delete'])
  await run(confirmInlineDelete)
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
  await run(closeOpenSheet)
  console.log('refused proxy save with host "a:1; PROXY x:8080": storage unchanged, host field marked')
}
