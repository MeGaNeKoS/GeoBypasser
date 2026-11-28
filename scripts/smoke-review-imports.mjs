import { STORAGE_WAIT_MS, UI_SETTLE_MS, sleep, waitFor } from './smoke-fixture.mjs'
import {
  answerReviewWithReplace,
  clickSelector,
  importFile,
  isReviewSheetOpen,
  readLocalStorage,
  writeLocalStorage,
} from './smoke-dashboard.mjs'

const RULE_NAME = 'review rule'
const RULE_MATCH = '*://review.example/*'
const SITE_DUPLICATE = 'good.example'
const SITE_NEW = 'review-site.example'
const KEEP_ALIVE_DUPLICATE_PROXY = 'proxy-good'
const KEEP_ALIVE_TAB_URL = 'review-keep.example'
const RESTORED_KEYS = ['rules', 'perWebsiteOverride', 'keepAliveRules']

const RULE_FILE = { rules: [{ active: true, name: RULE_NAME, match: [RULE_MATCH], proxyId: KEEP_ALIVE_DUPLICATE_PROXY }] }
const SITE_FILE = { perWebsiteOverride: { [SITE_DUPLICATE]: KEEP_ALIVE_DUPLICATE_PROXY, [SITE_NEW]: KEEP_ALIVE_DUPLICATE_PROXY } }
const KEEP_ALIVE_FILE = { keepAliveRules: { [KEEP_ALIVE_DUPLICATE_PROXY]: { active: false, tabUrls: [KEEP_ALIVE_TAB_URL] } } }

async function importThroughReview (run, { tab, inputId, file, failures, label, landed }) {
  await run(clickSelector, [`[data-tab="${tab}"]`])
  await sleep(UI_SETTLE_MS)
  await run(importFile, [inputId, JSON.stringify(file)])
  try {
    await waitFor(() => run(isReviewSheetOpen), STORAGE_WAIT_MS, `the ${label} import to open the Review step`)
    await run(answerReviewWithReplace)
    await waitFor(async () => landed(await run(readLocalStorage)), STORAGE_WAIT_MS, `the ${label} import to reach storage.local`)
  } catch (err) {
    failures.push(`${label} import through Review: ${err.message}`)
  }
}

export async function checkSectionImportsThroughReview (run, failures) {
  const failuresBefore = failures.length
  const starting = await run(readLocalStorage)
  try {
    await importThroughReview(run, {
      tab: 'rules',
      inputId: 'ruleImportInput',
      file: RULE_FILE,
      failures,
      label: 'rule',
      landed: stored => stored.rules.some(rule => rule?.name === RULE_NAME),
    })
    await importThroughReview(run, {
      tab: 'override',
      inputId: 'siteImportInput',
      file: SITE_FILE,
      failures,
      label: 'site (with a duplicate domain)',
      landed: stored => stored.perWebsiteOverride?.[SITE_NEW] === KEEP_ALIVE_DUPLICATE_PROXY,
    })
    await importThroughReview(run, {
      tab: 'keepalive',
      inputId: 'keepAliveImportInput',
      file: KEEP_ALIVE_FILE,
      failures,
      label: 'keep-alive (with a duplicate proxy)',
      landed: stored => stored.keepAliveRules?.[KEEP_ALIVE_DUPLICATE_PROXY]?.tabUrls?.includes(KEEP_ALIVE_TAB_URL) === true,
    })
  } finally {
    await run(writeLocalStorage, [restoredEntries(starting)])
  }
  if (failures.length === failuresBefore) {
    console.log('rule, site (with a duplicate domain), and keep-alive (with a duplicate proxy) imports each ended in the Review step and reached storage; storage restored')
  }
}

function restoredEntries (starting) {
  return Object.fromEntries(RESTORED_KEYS.map(key => [key, starting[key]]))
}
