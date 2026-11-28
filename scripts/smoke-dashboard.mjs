export function captureDownload (selector, label) {
  const realCreateObjectURL = URL.createObjectURL
  const realAnchorClick = HTMLAnchorElement.prototype.click
  let blob = null
  URL.createObjectURL = captured => {
    blob = captured
    return 'blob:smoke'
  }
  HTMLAnchorElement.prototype.click = function () {}
  try {
    const scope = document.querySelector(selector)
    if (label === undefined) scope.click()
    else Array.from(scope.querySelectorAll('button')).find(button => button.textContent.trim() === label).click()
  } finally {
    URL.createObjectURL = realCreateObjectURL
    HTMLAnchorElement.prototype.click = realAnchorClick
  }
  return blob ? blob.text() : null
}

export function clickSelector (selector) {
  const element = document.querySelector(selector)
  if (!element) throw new Error(`no element matches ${selector}`)
  element.click()
}

export function isCheckedSelector (selector) {
  return document.querySelector(selector).checked
}

export function readAttributeSelector (selector, attribute) {
  return document.querySelector(selector).getAttribute(attribute)
}

export function checkEveryConfigExportItem () {
  for (const box of document.querySelectorAll('#exportConfigItems input[type="checkbox"]')) box.checked = true
}

export function isDuplicateModalOpen () {
  return !document.getElementById('duplicateModal').classList.contains('hidden')
}

export function importFile (inputId, text) {
  const input = document.getElementById(inputId)
  const transfer = new DataTransfer()
  transfer.items.add(new File([text], 'import.json', { type: 'application/json' }))
  input.files = transfer.files
  input.dispatchEvent(new Event('change'))
}

export function readOpenSettingChange () {
  if (document.getElementById('settingChangeModal').classList.contains('hidden')) return null
  return {
    title: document.getElementById('settingChangeTitle').textContent,
    oldText: document.getElementById('settingChangeOld').textContent,
    newText: document.getElementById('settingChangeNew').textContent
  }
}

export function readFieldValue (fieldId) {
  return document.getElementById(fieldId).value
}

export function clickSettingChoice (choice) {
  document.getElementById(choice === 'apply' ? 'settingChangeApply' : 'settingChangeKeep').click()
}

export function pressEscapeInSettingChange () {
  const focused = document.activeElement
  if (!document.getElementById('settingChangeModal').contains(focused)) {
    throw new Error('the setting change dialog does not hold focus')
  }
  focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

export function selectProxyRowByHost (host) {
  const row = Array.from(document.querySelectorAll('#proxyContent li.row')).find(li => li.textContent.includes(host))
  const box = row.querySelector('input[type="checkbox"]')
  box.checked = true
  box.dispatchEvent(new Event('change'))
}

export function readLocalStorage () {
  return (globalThis.browser ?? globalThis.chrome).storage.local.get(null)
}

export function importFromUrl (url) {
  document.getElementById('importUrlInput').value = url
  document.getElementById('importUrlBtn').click()
}

export function refuseProxySave () {
  document.querySelector('[data-tab="proxy"]').click()
  Array.from(document.querySelectorAll('#proxyContent button')).find(button => button.textContent.trim() === 'Add proxy').click()
  document.querySelector('dialog.sheet input[name="host"]').value = 'a:1; PROXY x:8080'
  document.querySelector('dialog.sheet input[name="port"]').value = '8080'
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Save').click()
}

export function clickProxyRowAction (index, label) {
  const row = document.querySelectorAll('#proxyContent li.row')[index]
  if (!row) throw new Error(`no proxy row at ${index}`)
  Array.from(row.querySelectorAll('button')).find(button => button.textContent.trim() === label).click()
}

export function saveOpenProxySheetLabel (label) {
  document.querySelector('dialog.sheet input[name="label"]').value = label
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Save').click()
}

export function confirmInlineDelete () {
  Array.from(document.querySelectorAll('#proxyContent .inline-confirm button')).find(button => button.textContent.trim() === 'Delete').click()
}

export function openNewProxySheet () {
  document.querySelector('[data-tab="proxy"]').click()
  Array.from(document.querySelectorAll('#proxyContent button')).find(button => button.textContent.trim() === 'Add proxy').click()
}

export function isProxyDuplicateSheetOpen () {
  return document.querySelector('dialog.sheet input[name="choice"][value="replace"]') !== null
}

export function answerProxyDuplicateWithReplace () {
  document.querySelector('dialog.sheet input[name="choice"][value="replace"]').click()
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Apply').click()
}

export function closeOpenSheet () {
  document.querySelector('dialog.sheet button[aria-label="Close"]')?.click()
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Discard')?.click()
}

export function proxyHostMarkedInvalid () {
  return document.querySelector('dialog.sheet input[name="host"]').getAttribute('aria-invalid') === 'true'
}

export function saveOpenProxySheetAddress (host, port) {
  document.querySelector('dialog.sheet input[name="host"]').value = host
  document.querySelector('dialog.sheet input[name="port"]').value = String(port)
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Save').click()
}

export function clickKeepAliveFocusKey (focusKey) {
  document.querySelector(`#keepAliveContent [data-focus-key="${focusKey}"]`).click()
}

export function clickKeepAliveActiveFor (proxyId) {
  document.querySelector(`#keepAliveContent [data-focus-key="switch-${proxyId}"]`).click()
}

export function openNewKeepAliveSheet () {
  document.querySelector('[data-tab="keepalive"]').click()
  Array.from(document.querySelectorAll('#keepAliveContent button')).find(button => button.textContent.trim() === 'Add keep-alive rule').click()
}

export function fillAndSaveOpenKeepAliveSheet (proxyId, tabUrl) {
  document.querySelector('dialog.sheet select[name="proxyId"]').value = proxyId
  document.querySelector('dialog.sheet input[name="tabUrls"]').value = tabUrl
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Save').click()
}

export function selectKeepAliveRowFor (proxyId) {
  const row = document.querySelector(`#keepAliveContent [data-focus-key="edit-${proxyId}"]`).closest('li.row')
  const box = row.querySelector('input[type="checkbox"]')
  box.checked = true
  box.dispatchEvent(new Event('change'))
}

export function clickKeepAliveDeleteSelected () {
  Array.from(document.querySelectorAll('#keepAliveContent button')).find(button => button.textContent.trim() === 'Delete selected').click()
}

export function confirmKeepAliveInlineDelete () {
  Array.from(document.querySelectorAll('#keepAliveContent .inline-confirm button')).find(button => button.textContent.trim() === 'Delete').click()
}

export function writeLocalStorage (entries) {
  return (globalThis.browser ?? globalThis.chrome).storage.local.set(entries)
}

export function ruleSelectionState () {
  return {
    checked: document.querySelectorAll('#rulesContent li.row input[type="checkbox"]:checked').length,
    deleteShown: Array.from(document.querySelectorAll('#rulesContent button')).some(button => button.textContent.trim() === 'Delete selected'),
  }
}

export function selectOnlyRuleRowAt (index) {
  document.querySelectorAll('#rulesContent li.row input[type="checkbox"]').forEach((box, position) => {
    const wanted = position === index
    if (box.checked === wanted) return
    box.checked = wanted
    box.dispatchEvent(new Event('change'))
  })
}

export function clickRuleRowAction (index, label) {
  const row = document.querySelectorAll('#rulesContent li.row')[index]
  if (!row) throw new Error(`no rule row at ${index}`)
  Array.from(row.querySelectorAll('button')).find(button => button.textContent.trim() === label).click()
}

export function clickRuleToolbarButton (label) {
  Array.from(document.querySelectorAll('#rulesContent button')).find(button => button.textContent.trim() === label).click()
}

export function clickRuleActiveSwitch (index) {
  const row = document.querySelectorAll('#rulesContent li.row')[index]
  if (!row) throw new Error(`no rule row at ${index}`)
  row.querySelector('[role="switch"]').click()
}

export function confirmRuleInlineDelete () {
  Array.from(document.querySelectorAll('#rulesContent .inline-confirm button')).find(button => button.textContent.trim() === 'Delete').click()
}

export function openNewRuleSheet () {
  document.querySelector('[data-tab="rules"]').click()
  Array.from(document.querySelectorAll('#rulesContent button')).find(button => button.textContent.trim() === 'Add rule').click()
}

export function fillAndSaveOpenRuleSheet (name, match, proxyId) {
  document.querySelector('dialog.sheet input[name="name"]').value = name
  document.querySelector('dialog.sheet input[name="match"]').value = match
  document.querySelector('dialog.sheet select[name="proxyId"]').value = proxyId
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Save').click()
}

export function openNewSiteSheet () {
  document.querySelector('[data-tab="override"]').click()
  Array.from(document.querySelectorAll('#overrideContent button')).find(button => button.textContent.trim() === 'Add site').click()
}

export function fillAndSaveOpenSiteSheet (domain, proxyId) {
  document.querySelector('dialog.sheet input[name="domain"]').value = domain
  document.querySelector('dialog.sheet select[name="proxyId"]').value = proxyId
  Array.from(document.querySelectorAll('dialog.sheet button')).find(button => button.textContent.trim() === 'Save').click()
}

export function clickSiteRowAction (domain, label) {
  const row = Array.from(document.querySelectorAll('#overrideContent li.row')).find(item => item.querySelector('strong')?.textContent === domain)
  if (!row) throw new Error(`no site row for ${domain}`)
  Array.from(row.querySelectorAll('button')).find(button => button.textContent.trim() === label).click()
}

export function confirmSiteInlineDelete () {
  Array.from(document.querySelectorAll('#overrideContent .inline-confirm button')).find(button => button.textContent.trim() === 'Delete').click()
}

export function siteSectionShowsChromeLimit () {
  return document.getElementById('overrideContent').textContent.includes('Limited on Chrome')
}

export function countProxyRows () {
  return document.querySelectorAll('#proxyContent li.row').length
}

