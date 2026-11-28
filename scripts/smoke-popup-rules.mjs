import { POPUP_SETTLE_MS, runStep, sleep, STEP_TIMEOUT_MS, STORAGE_WAIT_MS, waitFor } from './smoke-fixture.mjs'

const FLIP_RULE = { active: true, name: 'good rule', match: ['*://good.example/*'], proxyId: 'proxy-good' }

export async function checkRuleFlipFromPopup (run, failures) {
  await runStep('popup flips a rule off and back on, and storage follows', () => flipRuleFromPopup(run), failures)
}

async function flipRuleFromPopup (run) {
  if (await run(storeActiveRule, [FLIP_RULE])) {
    await run(reloadPopup)
    await sleep(POPUP_SETTLE_MS)
  }
  await waitForRuleSwitch(run, FLIP_RULE.name, 'the active list')
  await run(clickRuleSwitch, [FLIP_RULE.name])
  await waitForRuleActive(run, FLIP_RULE.name, false)
  await run(clickPopupRuleFilter, ['inactive'])
  await waitForRuleSwitch(run, FLIP_RULE.name, 'the inactive list')
  await run(clickRuleSwitch, [FLIP_RULE.name])
  await waitForRuleActive(run, FLIP_RULE.name, true)
  console.log(`popup turned "${FLIP_RULE.name}" off and back on; storage holds it active again`)
}

async function waitForRuleSwitch (run, name, listDescription) {
  await waitFor(async () => (await run(ruleSwitchCount, [name])) > 0, STEP_TIMEOUT_MS, `"${name}" in ${listDescription} of the popup`)
}

async function waitForRuleActive (run, name, active) {
  await waitFor(
    async () => (await run(readRuleActive, [name])) === active,
    STORAGE_WAIT_MS,
    `storage to hold "${name}" active ${active}`,
  )
}

function clickRuleSwitch (name) {
  document.querySelector(`.popup-rules [role="switch"][aria-label="${name}"]`).click()
  return true
}

function clickPopupRuleFilter (value) {
  document.querySelector(`input[name="ruleFilter"][value="${value}"]`).click()
  return true
}

function ruleSwitchCount (name) {
  return document.querySelectorAll(`.popup-rules [role="switch"][aria-label="${name}"]`).length
}

function reloadPopup () {
  location.reload()
  return true
}

async function storeActiveRule (rule) {
  const api = globalThis.browser ?? globalThis.chrome
  const { rules = [] } = await api.storage.local.get('rules')
  if (rules.some(existing => existing?.name === rule.name && existing.active === true)) return false
  const others = rules.filter(existing => existing?.name !== rule.name)
  await api.storage.local.set({ rules: [...others, rule] })
  return true
}

async function readRuleActive (name) {
  const api = globalThis.browser ?? globalThis.chrome
  const { rules = [] } = await api.storage.local.get('rules')
  return rules.find(rule => rule?.name === name)?.active
}
