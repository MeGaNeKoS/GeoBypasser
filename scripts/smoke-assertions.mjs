import { canon, CREDENTIAL_PROXY, FIXTURE, serveImportFile, SET_ASIDE_EDIT_INDEXES, SET_ASIDE_PROXY, SET_ASIDE_RULE, sleep, STORAGE_WAIT_MS, UI_SETTLE_MS, URL_IMPORT_FILE, waitFor } from './smoke-fixture.mjs'
import { clickKeepAliveActiveFor, clickKeepAliveDeleteSelected, clickKeepAliveFocusKey, clickProxyRowAction, clickRuleActiveSwitch, clickRuleRowAction, clickSelector, closeOpenSheet, confirmInlineDelete, clickSiteRowAction, confirmKeepAliveInlineDelete, confirmRuleInlineDelete, confirmSiteInlineDelete, fillAndSaveOpenKeepAliveSheet, keepAliveSheetFieldsReady, fillAndSaveOpenRuleSheet, fillAndSaveOpenSiteSheet, importFromUrl, isSheetOpen, openNewKeepAliveSheet, openNewRuleSheet, openNewSiteSheet, proxyHostMarkedInvalid, readLocalStorage, refuseProxySave, ruleSelectionState, saveOpenProxySheetLabel, selectKeepAliveRowFor, selectOnlyRuleRowAt, writeLocalStorage } from './smoke-dashboard.mjs'

const PROXY_LABEL_AFTER_EDIT = 'edited in proxies'

async function waitForOpenSheet (run, what) {
  await waitFor(() => run(isSheetOpen), STORAGE_WAIT_MS, what)
}

async function waitForKeepAliveSheetFields (run, what) {
  await waitFor(() => run(keepAliveSheetFieldsReady), STORAGE_WAIT_MS, what)
}

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
  await run(clickRuleActiveSwitch, [0])
  await waitFor(async () => (await run(readLocalStorage)).rules[0].active !== ruleActiveBefore, STORAGE_WAIT_MS, 'the rule save to reach storage.local')
  if ((await run(readLocalStorage)).proxyList[0]?.label !== PROXY_LABEL_AFTER_EDIT) failures.push('a proxy edit in the proxies section was reverted by a later rule save')
  await run(clickRuleActiveSwitch, [0])
  await waitFor(async () => (await run(readLocalStorage)).rules[0].active === ruleActiveBefore, STORAGE_WAIT_MS, 'the rule to be restored')
  await setFirstProxyLabel(run, originalLabel)
  if (failures.length === failuresBefore) {
    console.log('proxy label edited in the proxies section survived a later rule save and was restored')
  }
}

export async function checkRuleRowsAfterReread (run, failures) {
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
  await run(selectOnlyRuleRowAt, [0])
  await sleep(UI_SETTLE_MS)
  if (!(await run(ruleSelectionState)).deleteShown) failures.push('selecting a rule did not show Delete selected')
  await run(writeLocalStorage, [{ fallbackDirect: !before.fallbackDirect }])
  await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === !before.fallbackDirect, STORAGE_WAIT_MS, 'the outside save to reach storage.local')
  await sleep(UI_SETTLE_MS)
  const selection = await run(ruleSelectionState)
  if (selection.checked > 0 || selection.deleteShown) failures.push('an outside save left a rule selected')
  if (canon((await run(readLocalStorage)).rules) !== canon(before.rules)) failures.push('an outside save changed the stored rules')
  await run(writeLocalStorage, [{ fallbackDirect: before.fallbackDirect }])
  await waitFor(async () => (await run(readLocalStorage)).fallbackDirect === before.fallbackDirect, STORAGE_WAIT_MS, 'the outside save to be restored')

  await run(clickRuleRowAction, [0, 'Delete'])
  await run(confirmRuleInlineDelete)
  await waitFor(async () => canon((await run(readLocalStorage)).rules) === canon(before.rules.slice(1)), STORAGE_WAIT_MS, 'the rule delete to reach storage.local')
  if ((await run(readLocalStorage)).proxyList[0]?.label !== PROXY_LABEL_AFTER_EDIT) failures.push('a rule delete reverted the proxy edit made in the proxies section')

  await run(writeLocalStorage, [{ rules: before.rules }])
  await waitFor(async () => canon((await run(readLocalStorage)).rules) === canon(before.rules), STORAGE_WAIT_MS, 'the deleted rule to be restored')
  await setFirstProxyLabel(run, originalLabel)
  console.log('keep-alive toggle, rule selection cleared by an outside save, and rule delete after a proxy edit and storage re-read: all held, the proxy edit survived, then restored')
}

const SMOKE_RULE_NAME = 'smoke rule'
const SMOKE_RULE_RENAMED = 'smoke rule renamed'
const SMOKE_RULE_MATCH = '*://smoke.example/*'
const SMOKE_RULE_PROXY = 'proxy-good'

export async function checkRuleAddEditDelete (run, failures) {
  const before = await run(readLocalStorage)
  await run(openNewRuleSheet)
  await waitForOpenSheet(run, 'the rule sheet to open')
  await run(fillAndSaveOpenRuleSheet, [SMOKE_RULE_NAME, SMOKE_RULE_MATCH, SMOKE_RULE_PROXY])
  await waitFor(async () => (await run(readLocalStorage)).rules.length === before.rules.length + 1, STORAGE_WAIT_MS, 'the added rule to reach storage.local')
  const added = (await run(readLocalStorage)).rules.at(-1)
  if (added?.name !== SMOKE_RULE_NAME || added?.proxyId !== SMOKE_RULE_PROXY) failures.push('a rule added in the rules section was not stored with its name and proxy')
  await sleep(UI_SETTLE_MS)

  const addedIndex = before.rules.length
  await run(clickRuleRowAction, [addedIndex, 'Edit'])
  await run(fillAndSaveOpenRuleSheet, [SMOKE_RULE_RENAMED, SMOKE_RULE_MATCH, SMOKE_RULE_PROXY])
  await waitFor(async () => (await run(readLocalStorage)).rules.at(-1)?.name === SMOKE_RULE_RENAMED, STORAGE_WAIT_MS, 'the edited rule to reach storage.local')
  await sleep(UI_SETTLE_MS)

  await run(clickRuleRowAction, [addedIndex, 'Delete'])
  await run(confirmRuleInlineDelete)
  await waitFor(async () => canon((await run(readLocalStorage)).rules) === canon(before.rules), STORAGE_WAIT_MS, 'the deleted smoke rule to leave storage.local')
  console.log('rule added, edited, and deleted through the rules section; storage matches the starting list')
}

const SMOKE_SITE_DOMAIN = 'smoke.example'
const SMOKE_SITE_RENAMED = 'smoke-renamed.example'
const SMOKE_SITE_PROXY = 'proxy-good'

export async function checkSiteAddEditDelete (run, failures) {
  const before = await run(readLocalStorage)
  const startingSites = before.perWebsiteOverride ?? {}
  await run(openNewSiteSheet)
  await waitForOpenSheet(run, 'the site sheet to open')
  await run(fillAndSaveOpenSiteSheet, [SMOKE_SITE_DOMAIN, SMOKE_SITE_PROXY])
  await waitFor(async () => (await run(readLocalStorage)).perWebsiteOverride?.[SMOKE_SITE_DOMAIN] === SMOKE_SITE_PROXY, STORAGE_WAIT_MS, 'the added site to reach storage.local')
  await sleep(UI_SETTLE_MS)

  await run(clickSiteRowAction, [SMOKE_SITE_DOMAIN, 'Edit'])
  await run(fillAndSaveOpenSiteSheet, [SMOKE_SITE_RENAMED, SMOKE_SITE_PROXY])
  await waitFor(async () => {
    const sites = (await run(readLocalStorage)).perWebsiteOverride ?? {}
    return sites[SMOKE_SITE_RENAMED] === SMOKE_SITE_PROXY && !(SMOKE_SITE_DOMAIN in sites)
  }, STORAGE_WAIT_MS, 'the renamed site to reach storage.local under its new domain')
  await sleep(UI_SETTLE_MS)

  await run(clickSiteRowAction, [SMOKE_SITE_RENAMED, 'Delete'])
  await run(confirmSiteInlineDelete)
  await waitFor(async () => canon((await run(readLocalStorage)).perWebsiteOverride ?? {}) === canon(startingSites), STORAGE_WAIT_MS, 'the deleted smoke site to leave storage.local')
  console.log('site added, renamed through the sites section, and deleted; storage matches the starting sites')
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
    await run(clickProxyRowAction, [index, 'Fix'])
    await run(closeOpenSheet)
    await run(clickSelector, ['[data-tab="rules"]'])
    await sleep(UI_SETTLE_MS)
    await run(clickRuleRowAction, [index, 'Fix'])
    await run(closeOpenSheet)
  }
  console.log(`clicked Edit on set aside rows ${SET_ASIDE_EDIT_INDEXES.join(', ')} of both tables`)
}

export async function removeSetAsideEntries (run, failures) {
  await run(clickSelector, ['[data-tab="rules"]'])
  await sleep(UI_SETTLE_MS)
  await run(clickRuleRowAction, [SET_ASIDE_RULE, 'Delete'])
  await run(confirmRuleInlineDelete)
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

const KEEP_ALIVE_SMOKE_PROXY = CREDENTIAL_PROXY.id
const KEEP_ALIVE_SMOKE_TAB_URL = 'smoke.example'
const KEEP_ALIVE_SMOKE_TAB_URL_EDITED = 'smoke-edited.example'

export async function checkKeepAliveAddEditDelete (run, failures) {
  const startingRules = (await run(readLocalStorage)).keepAliveRules ?? {}
  await run(openNewKeepAliveSheet)
  await waitForKeepAliveSheetFields(run, 'the keep-alive sheet fields to render')
  await run(fillAndSaveOpenKeepAliveSheet, [KEEP_ALIVE_SMOKE_PROXY, KEEP_ALIVE_SMOKE_TAB_URL])
  await waitFor(async () => (await run(readLocalStorage)).keepAliveRules?.[KEEP_ALIVE_SMOKE_PROXY]?.tabUrls?.includes(KEEP_ALIVE_SMOKE_TAB_URL) === true, STORAGE_WAIT_MS, 'the added keep-alive rule to reach storage.local')
  await sleep(UI_SETTLE_MS)
  await run(clickKeepAliveFocusKey, [`edit-${KEEP_ALIVE_SMOKE_PROXY}`])
  await waitForKeepAliveSheetFields(run, 'the edit keep-alive sheet fields to render')
  await run(fillAndSaveOpenKeepAliveSheet, [KEEP_ALIVE_SMOKE_PROXY, KEEP_ALIVE_SMOKE_TAB_URL_EDITED])
  await waitFor(async () => (await run(readLocalStorage)).keepAliveRules?.[KEEP_ALIVE_SMOKE_PROXY]?.tabUrls?.includes(KEEP_ALIVE_SMOKE_TAB_URL_EDITED) === true, STORAGE_WAIT_MS, 'the edited keep-alive rule to reach storage.local')
  await sleep(UI_SETTLE_MS)
  await run(selectKeepAliveRowFor, [KEEP_ALIVE_SMOKE_PROXY])
  await run(clickKeepAliveDeleteSelected)
  await run(confirmKeepAliveInlineDelete)
  await waitFor(async () => canon((await run(readLocalStorage)).keepAliveRules ?? {}) === canon(startingRules), STORAGE_WAIT_MS, 'the deleted keep-alive rule to leave storage.local')
  console.log('keep-alive rule added, edited, and deleted through the keep-alive section; storage matches the starting rules')
}
