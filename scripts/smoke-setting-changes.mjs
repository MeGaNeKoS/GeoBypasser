import { serveImportFile, STORAGE_WAIT_MS, waitFor } from './smoke-fixture.mjs'
import { clickSelector, clickSettingChoice, importFromUrl, pressEscapeInSettingChange, readFieldValue, readLocalStorage, readOpenSettingChange } from './smoke-dashboard.mjs'

const CHANGE_CHECK_URL = 'https://settings-check.example/'
const CHANGE_CHECK_RULE = 'settings check rule'

const SETTINGS_IMPORT_FILE = {
  defaultProxy: 'proxy-creds',
  fallbackDirect: true,
  testProxyUrl: CHANGE_CHECK_URL,
  rules: [{ active: true, name: CHANGE_CHECK_RULE, match: ['*://settings.example/*'], proxyId: 'proxy-good' }]
}

function changePromptsFor (before) {
  return [
    { title: 'Default proxy', oldText: 'good', newText: 'creds.lan', choice: 'escape' },
    { title: 'Connect directly when a proxy fails', oldText: 'Off', newText: 'On', choice: 'apply' },
    { title: 'Test URL', oldText: before.testProxyUrl, newText: CHANGE_CHECK_URL, choice: 'keep' }
  ]
}

async function answerChangePrompt (run, failures, prompt) {
  const shown = await waitFor(async () => {
    const open = await run(readOpenSettingChange)
    return open?.title === prompt.title ? open : undefined
  }, STORAGE_WAIT_MS, `the "${prompt.title}" change prompt`)
  if (shown.oldText !== prompt.oldText || shown.newText !== prompt.newText) {
    failures.push(`"${prompt.title}" prompt showed "${shown.oldText}" and "${shown.newText}"`)
  }
  if (prompt.choice === 'escape') await run(pressEscapeInSettingChange)
  else await run(clickSettingChoice, [prompt.choice])
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

export async function checkSettingChanges (run, failures) {
  const before = await run(readLocalStorage)
  const current = { ...before, testProxyUrl: await readShownTestUrl(run) }
  const failuresBefore = failures.length
  const settingsFile = await serveImportFile(JSON.stringify(SETTINGS_IMPORT_FILE))
  try {
    await run(importFromUrl, [settingsFile.url])
    for (const prompt of changePromptsFor(current)) await answerChangePrompt(run, failures, prompt)
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
    console.log(`settings import from ${settingsFile.url}: three prompts in order, default proxy kept with Escape, test URL kept by click, fallback applied by click, rule stored`)
  }
}
