import { serveImportFile, STORAGE_WAIT_MS, UI_SETTLE_MS, sleep, waitFor } from './smoke-fixture.mjs'
import { clickReviewImport, clickSelector, fillAndSaveOpenUrlSheet, isReviewSheetOpen, openImportUrlSheet, readFieldValue, readLocalStorage, readReviewSettingLabels, setReviewSettingChecked } from './smoke-dashboard.mjs'

const CHANGE_CHECK_URL = 'https://settings-check.example/'
const CHANGE_CHECK_RULE = 'settings check rule'

const SETTINGS_IMPORT_FILE = {
  defaultProxy: 'proxy-creds',
  fallbackDirect: true,
  testProxyUrl: CHANGE_CHECK_URL,
  rules: [{ active: true, name: CHANGE_CHECK_RULE, match: ['*://settings.example/*'], proxyId: 'proxy-good' }]
}

function settingLabel (title, oldText, newText) {
  return `${title}: ${oldText}, becomes ${newText}`
}

function settingDecisionsFor (before) {
  return [
    { label: settingLabel('Default proxy', 'good', 'creds.lan'), apply: false },
    { label: settingLabel('Connect directly when a proxy fails', 'Off', 'On'), apply: true },
    { label: settingLabel('Test URL', before.testProxyUrl, CHANGE_CHECK_URL), apply: false },
  ]
}

async function chooseSettingChanges (run, failures, decisions) {
  const shown = await run(readReviewSettingLabels)
  const expected = decisions.map(decision => decision.label)
  if (JSON.stringify(shown) !== JSON.stringify(expected)) {
    failures.push(`the Review sheet listed ${JSON.stringify(shown)}, expected ${JSON.stringify(expected)}`)
  }
  for (const decision of decisions) await run(setReviewSettingChecked, [decision.label, decision.apply])
}

function expectedSettingsAfterChoices (before) {
  return { defaultProxy: before.defaultProxy, fallbackDirect: true, testProxyUrl: before.testProxyUrl }
}

async function readShownTestUrl (run) {
  await run(clickSelector, ['[data-tab="general"]'])
  const shown = await waitFor(() => run(readFieldValue, ['testProxyUrl']), STORAGE_WAIT_MS, 'the Defaults test URL field')
  await run(clickSelector, ['[data-tab="impexp"]'])
  return shown
}

async function importSettingsThroughReview (run, failures, settingsUrl, decisions) {
  await run(openImportUrlSheet)
  await run(fillAndSaveOpenUrlSheet, [settingsUrl])
  await waitFor(() => run(isReviewSheetOpen), STORAGE_WAIT_MS, 'the Review sheet for the settings file')
  await chooseSettingChanges(run, failures, decisions)
  await run(clickReviewImport)
}

export async function checkSettingChanges (run, failures) {
  const before = await run(readLocalStorage)
  const current = { ...before, testProxyUrl: await readShownTestUrl(run) }
  const failuresBefore = failures.length
  const settingsFile = await serveImportFile(JSON.stringify(SETTINGS_IMPORT_FILE))
  try {
    await sleep(UI_SETTLE_MS)
    await importSettingsThroughReview(run, failures, settingsFile.url, settingDecisionsFor(current))
    await waitFor(async () => {
      const stored = await run(readLocalStorage)
      return stored.rules.some(rule => rule?.name === CHANGE_CHECK_RULE)
    }, STORAGE_WAIT_MS, 'the settings import to reach storage.local')
  } catch (err) {
    failures.push(`settings import: ${err.message}`)
  } finally {
    await settingsFile.close()
  }
  const after = await run(readLocalStorage)
  for (const [key, value] of Object.entries(expectedSettingsAfterChoices(before))) {
    if (after[key] !== value) failures.push(`storage ${key} is ${JSON.stringify(after[key])} after the settings import, expected ${JSON.stringify(value)}`)
  }
  if (failures.length === failuresBefore) {
    console.log(`settings import from ${settingsFile.url}: Review lists three setting changes in order, default proxy and test URL unchecked, fallback checked, rule stored`)
  }
}
