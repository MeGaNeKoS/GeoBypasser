export function captureDownload (selector) {
  const realCreateObjectURL = URL.createObjectURL
  const realAnchorClick = HTMLAnchorElement.prototype.click
  let blob = null
  URL.createObjectURL = captured => {
    blob = captured
    return 'blob:smoke'
  }
  HTMLAnchorElement.prototype.click = function () {}
  try {
    document.querySelector(selector).click()
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

export function selectProxyRowByHost (host) {
  const row = Array.from(document.querySelectorAll('#proxyTable tbody tr')).find(tr => tr.textContent.includes(host))
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
  document.getElementById('addProxy').click()
  document.getElementById('proxyHost').value = 'a:1; PROXY x:8080'
  document.getElementById('proxyPort').value = '8080'
  document.getElementById('saveProxy').click()
}

export function proxyHostMarkedInvalid () {
  return document.getElementById('proxyHost').classList.contains('invalid')
}
