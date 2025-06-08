import browser from 'webextension-polyfill'
import { getConfig, saveConfig, updateConfig } from '@utils/storage'
import { APP_NAME } from '@constant/defaults'
import { WEB_REQUEST_RESOURCE_TYPES } from '@constant/requestTypes'
import { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { matchPattern } from 'browser-extension-url-match'

let config: Awaited<ReturnType<typeof getConfig>>
let editingProxyIndex: number | null = null
let editingRuleIndex: number | null = null
let revealAllPasswords = false
const revealedPasswords = new Set<number>()
const selectedRules = new Set<number>()
let listTargetInput: HTMLInputElement | null = null
let currentListValidator: (val: string) => boolean = () => true
let typeTargetInput: HTMLInputElement | null = null

function switchTab (id: string) {
  document.querySelectorAll('section.tab').forEach(sec => sec.classList.remove('active'))
  const el = document.getElementById(id)
  if (el) el.classList.add('active')
}

function createOption (id: string, label: string) {
  const opt = document.createElement('option')
  opt.value = id
  opt.textContent = label
  return opt
}

function updatePassHeaderButton () {
  const btn = document.getElementById('togglePassColumn') as HTMLButtonElement
  if (btn) btn.textContent = revealAllPasswords ? 'Hide' : 'Show'
}

function setValidation (el: HTMLInputElement, validate: (val: string) => boolean) {
  function run () {
    if (!el.value.trim()) {
      el.classList.remove('valid', 'invalid')
      return
    }
    if (validate(el.value)) {
      el.classList.add('valid')
      el.classList.remove('invalid')
    } else {
      el.classList.add('invalid')
      el.classList.remove('valid')
    }
  }
  el.addEventListener('input', run)
  run()
}

function validatePatternList (val: string) {
  try {
    return val.split(/\s*,\s*/).filter(Boolean).every(p => {
      matchPattern(p, { strict: false }).assertValid()
      return true
    })
  } catch {
    return false
  }
}

function validatePattern (val: string) {
  try {
    matchPattern(val, { strict: false }).assertValid()
    return true
  } catch {
    return false
  }
}

function validateResourceTypes (val: string) {
  return val.split(/\s*,\s*/).filter(Boolean).every(v => WEB_REQUEST_RESOURCE_TYPES.includes(v as any))
}

function validateRegExp (val: string) {
  if (!val.trim()) return true
  const m = val.match(/^\/(.*)\/([gimsuy]*)$/)
  if (!m) return false
  try { new RegExp(m[1], m[2]) } catch { return false }
  return true
}

function updateListDisplay (input: HTMLInputElement) {
  const span = document.getElementById(input.id + 'Display')
  if (span) {
    const arr = input.value.split(/\s*,\s*/).filter(Boolean)
    span.textContent = arr.length ? arr.join(', ') : 'None'
  }
}

function addListItem (container: HTMLElement, value = '') {
  const div = document.createElement('div')
  const inp = document.createElement('input')
  inp.type = 'text'
  inp.value = value
  setValidation(inp, currentListValidator)
  const btn = document.createElement('button')
  btn.textContent = 'x'
  btn.onclick = () => div.remove()
  div.appendChild(inp)
  div.appendChild(btn)
  container.appendChild(div)
}

function openListModal (inputId: string, title: string, validator: (v: string) => boolean) {
  listTargetInput = document.getElementById(inputId) as HTMLInputElement
  currentListValidator = validator
  const modal = document.getElementById('listModal')!
  const heading = document.getElementById('listModalTitle')!
  const container = document.getElementById('listModalItems')!
  heading.textContent = title
  container.innerHTML = ''
  const arr = listTargetInput.value.split(/\s*,\s*/).filter(Boolean)
  if (arr.length === 0) addListItem(container)
  else arr.forEach(v => addListItem(container, v))
  modal.classList.remove('hidden')
}

function closeListModal () {
  document.getElementById('listModal')!.classList.add('hidden')
  listTargetInput = null
}

function saveListModal () {
  if (!listTargetInput) return
  const container = document.getElementById('listModalItems')!
  const values: string[] = []
  container.querySelectorAll('input').forEach(inp => {
    const v = (inp as HTMLInputElement).value.trim()
    if (v) values.push(v)
  })
  listTargetInput.value = values.join(', ')
  updateListDisplay(listTargetInput)
  closeListModal()
}

function openTypeModal (inputId: string) {
  typeTargetInput = document.getElementById(inputId) as HTMLInputElement
  const modal = document.getElementById('typeModal')!
  const container = document.getElementById('typeModalItems')!
  container.innerHTML = ''
  const selected = new Set(typeTargetInput.value.split(/\s*,\s*/).filter(Boolean))
  WEB_REQUEST_RESOURCE_TYPES.forEach(t => {
    const label = document.createElement('label')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.value = t
    chk.checked = selected.has(t)
    label.appendChild(chk)
    label.append(' ', t)
    container.appendChild(label)
    container.appendChild(document.createElement('br'))
  })
  modal.classList.remove('hidden')
}

function closeTypeModal () {
  document.getElementById('typeModal')!.classList.add('hidden')
  typeTargetInput = null
}

function saveTypeModal () {
  if (!typeTargetInput) return
  const container = document.getElementById('typeModalItems')!
  const vals: string[] = []
  container.querySelectorAll('input[type="checkbox"]').forEach(inp => {
    const el = inp as HTMLInputElement
    if (el.checked) vals.push(el.value)
  })
  typeTargetInput.value = vals.join(', ')
  updateListDisplay(typeTargetInput)
  closeTypeModal()
}

function renderGeneral () {
  const select = document.getElementById('defaultProxy') as HTMLSelectElement
  select.innerHTML = '<option value="">None</option>'
  config.proxyList.forEach(p => select.appendChild(createOption(p.id, p.label || p.host)))
  select.value = config.defaultProxy || ''

  const fallback = document.getElementById('fallbackDirect') as HTMLInputElement
  fallback.checked = !!config.fallbackDirect

  const testUrl = document.getElementById('testProxyUrl') as HTMLInputElement
  testUrl.value = config.testProxyUrl

  // const mode = document.getElementById('storageMode') as HTMLSelectElement
  // browser.storage.local.get('storageMode').then(res => {
  //   mode.value = res.storageMode === 'cloud' ? 'cloud' : 'local'
  // })

  select.onchange = () => updateConfig({ defaultProxy: select.value || undefined })
  fallback.onchange = () => updateConfig({ fallbackDirect: fallback.checked })
  testUrl.onchange = () => updateConfig({ testProxyUrl: testUrl.value })
  // mode.onchange = () => browser.storage.local.set({ storageMode: mode.value })
}

function renderProxyList () {
  const tbody = document.querySelector('#proxyTable tbody') as HTMLElement
  tbody.innerHTML = ''
  config.proxyList.forEach((p, idx) => {
    const tr = document.createElement('tr')

    const visible = revealAllPasswords || revealedPasswords.has(idx)

    tr.innerHTML =
      `<td>${p.label || p.host}</td>` +
      `<td>${p.type === 'socks' ? 'socks5' : p.type}</td>` +
      `<td>${p.host}</td>` +
      `<td>${p.port}</td>` +
      `<td>${p.username || ''}</td>` +
      `<td class="password">${p.password ? (visible ? p.password : '******') : ''}</td>` +
      `<td><input type="checkbox" ${p.notifyIfDown ? 'checked' : ''}></td>` +
      `<td><button data-edit="${idx}">Edit</button> ` +
      `<button data-remove="${idx}">Delete</button></td>`

    tbody.appendChild(tr)

    const passCell = tr.querySelector('td.password') as HTMLTableCellElement
    if (p.password) {
      const toggle = document.createElement('button')
      toggle.textContent = visible ? 'Hide' : 'Show'
      toggle.dataset.index = String(idx)
      toggle.onclick = () => {
        if (revealedPasswords.has(idx)) {
          revealedPasswords.delete(idx)
        } else {
          revealedPasswords.add(idx)
        }
        renderProxyList()
        updatePassHeaderButton()
      }
      passCell.append(' ', toggle)
    }

    const chk = tr.querySelector('input') as HTMLInputElement
    chk.onchange = () => {
      p.notifyIfDown = chk.checked
      saveConfig(config)
    }
    const editBtn = tr.querySelector('button[data-edit]') as HTMLButtonElement
    editBtn.onclick = () => openProxyModal(idx)
    const del = tr.querySelector('button[data-remove]') as HTMLButtonElement
    del.onclick = () => {
      config.proxyList.splice(idx, 1)
      saveConfig(config).then(renderAll)
    }
  })
  updatePassHeaderButton()
}

function openProxyModal (index?: number) {
  editingProxyIndex = typeof index === 'number' ? index : null
  const modal = document.getElementById('proxyModal')!
  const title = document.getElementById('proxyModalTitle')!
  const label = document.getElementById('proxyLabel') as HTMLInputElement
  const type = document.getElementById('proxyType') as HTMLSelectElement
  const host = document.getElementById('proxyHost') as HTMLInputElement
  const port = document.getElementById('proxyPort') as HTMLInputElement
  port.min = '1'
  port.max = '65535'
  const user = document.getElementById('proxyUser') as HTMLInputElement
  const pass = document.getElementById('proxyPass') as HTMLInputElement
  const notify = document.getElementById('proxyNotify') as HTMLInputElement

  if (editingProxyIndex !== null) {
    const p = config.proxyList[editingProxyIndex]
    title.textContent = 'Edit Proxy'
    label.value = p.label || ''
    type.value = p.type
    host.value = p.host
    port.value = String(p.port)
    user.value = p.username || ''
    pass.value = p.password || ''
    notify.checked = !!p.notifyIfDown
  } else {
    title.textContent = 'Add Proxy'
    label.value = ''
    type.value = 'http'
    host.value = ''
    port.value = ''
    user.value = ''
    pass.value = ''
    notify.checked = false
  }

  modal.classList.remove('hidden')
}

function closeProxyModal () {
  document.getElementById('proxyModal')!.classList.add('hidden')
}

function saveProxyFromModal () {
  const label = (document.getElementById('proxyLabel') as HTMLInputElement).value
  const type = (document.getElementById('proxyType') as HTMLSelectElement).value as any
  const host = (document.getElementById('proxyHost') as HTMLInputElement).value
  const port = Number((document.getElementById('proxyPort') as HTMLInputElement).value)
  const username = (document.getElementById('proxyUser') as HTMLInputElement).value
  const password = (document.getElementById('proxyPass') as HTMLInputElement).value
  const notify = (document.getElementById('proxyNotify') as HTMLInputElement).checked

  if (!host || !port || port < 1 || port > 65535) return

  const base: ProxyListItem = {
    id: editingProxyIndex !== null ? config.proxyList[editingProxyIndex].id : crypto.randomUUID(),
    type,
    host,
    port,
    proxyDNS: true,
  }
  if (label) base.label = label
  if (username) base.username = username
  if (password) base.password = password
  if (notify) base.notifyIfDown = true

  if (editingProxyIndex !== null) {
    config.proxyList[editingProxyIndex] = base
  } else {
    config.proxyList.push(base)
  }

  saveConfig(config).then(() => { renderAll(); closeProxyModal() })
}

function renderRules () {
  const tbody = document.querySelector('#ruleTable tbody') as HTMLElement
  tbody.innerHTML = ''
  config.rules.forEach((r, idx) => {
    const tr = document.createElement('tr')
    const proxy = config.proxyList.find(p => p.id === r.proxyId)
    const proxyLabel = proxy ? (proxy.label || proxy.host) : r.proxyId
    tr.innerHTML =
      `<td><input type="checkbox" data-active ${r.active ? 'checked' : ''}></td>` +
      `<td>${r.name}</td>` +
      `<td>${r.match.join(', ')}</td>` +
      `<td>${proxyLabel}</td>` +
      `<td><input type="checkbox" data-select="${idx}"></td>` +
      `<td><button data-edit="${idx}">Edit</button> ` +
      `<button data-remove="${idx}">Delete</button> ` +
      `<button data-export="${idx}">Export</button></td>`
    if (!proxy) tr.classList.add('missing-proxy')
    tbody.appendChild(tr)
    const activeChk = tr.querySelector('input[data-active]') as HTMLInputElement
    activeChk.onchange = () => { r.active = activeChk.checked; saveConfig(config) }
    const selChk = tr.querySelector('input[data-select]') as HTMLInputElement
    selChk.onchange = () => {
      if (selChk.checked) selectedRules.add(idx)
      else selectedRules.delete(idx)
    }
    const edit = tr.querySelector('button[data-edit]') as HTMLButtonElement
    edit.onclick = () => openRuleModal(idx)
    const del = tr.querySelector('button[data-remove]') as HTMLButtonElement
    del.onclick = () => { config.rules.splice(idx,1); saveConfig(config).then(renderAll) }
    const exp = tr.querySelector('button[data-export]') as HTMLButtonElement
    exp.onclick = () => exportRules([r])
  })
}

function addRule () {
  openRuleModal()
}

function openRuleModal (index?: number) {
  editingRuleIndex = typeof index === 'number' ? index : null
  const modal = document.getElementById('ruleModal')!
  const title = document.getElementById('ruleModalTitle')!
  const name = document.getElementById('ruleName') as HTMLInputElement
  const match = document.getElementById('ruleMatch') as HTMLInputElement
  const proxy = document.getElementById('ruleProxy') as HTMLSelectElement
  const bypassUrls = document.getElementById('ruleBypassUrls') as HTMLInputElement
  const bypassTypes = document.getElementById('ruleBypassTypes') as HTMLInputElement
  const staticExt = document.getElementById('ruleStaticExt') as HTMLInputElement
  const forceUrls = document.getElementById('ruleForceUrls') as HTMLInputElement
  const fbDirect = document.getElementById('ruleFallbackDirect') as HTMLInputElement
  const active = document.getElementById('ruleActive') as HTMLInputElement

  proxy.innerHTML = ''
  config.proxyList.forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))

  if (editingRuleIndex !== null) {
    const r = config.rules[editingRuleIndex]
    title.textContent = 'Edit Rule'
    name.value = r.name
    match.value = r.match.join(', ')
    proxy.value = r.proxyId
    bypassUrls.value = (r.bypassUrlPatterns || []).join(', ')
    bypassTypes.value = (r.bypassResourceTypes || []).join(', ')
    staticExt.value = r.staticExtensions || ''
    forceUrls.value = (r.forceProxyUrlPatterns || []).join(', ')
    fbDirect.checked = !!r.fallbackDirect
    active.checked = !!r.active
  } else {
    title.textContent = 'Add Rule'
    name.value = ''
    match.value = ''
    proxy.value = config.proxyList[0]?.id || ''
    bypassUrls.value = ''
    bypassTypes.value = ''
    staticExt.value = ''
    forceUrls.value = ''
    fbDirect.checked = true
    active.checked = true
  }

  setValidation(match, validatePatternList)
  setValidation(bypassUrls, validatePatternList)
  setValidation(bypassTypes, validateResourceTypes)
  setValidation(staticExt, validateRegExp)
  setValidation(forceUrls, validatePatternList)
  updateListDisplay(match)
  updateListDisplay(bypassUrls)
  updateListDisplay(bypassTypes)
  updateListDisplay(forceUrls)

  modal.classList.remove('hidden')
}

function closeRuleModal () {
  document.getElementById('ruleModal')!.classList.add('hidden')
}

function saveRuleFromModal () {
  const name = (document.getElementById('ruleName') as HTMLInputElement).value.trim()
  const match = (document.getElementById('ruleMatch') as HTMLInputElement).value
  const proxyId = (document.getElementById('ruleProxy') as HTMLSelectElement).value
  const bypassUrls = (document.getElementById('ruleBypassUrls') as HTMLInputElement).value
  const bypassTypes = (document.getElementById('ruleBypassTypes') as HTMLInputElement).value
  const staticExt = (document.getElementById('ruleStaticExt') as HTMLInputElement).value
  const forceUrls = (document.getElementById('ruleForceUrls') as HTMLInputElement).value
  const fbDirect = (document.getElementById('ruleFallbackDirect') as HTMLInputElement).checked
  const active = (document.getElementById('ruleActive') as HTMLInputElement).checked

  if (!name || !match || !proxyId) return

  const rule: ProxyRule = {
    name,
    match: match.split(/\s*,\s*/).filter(Boolean),
    proxyId,
    active,
  }
  if (bypassUrls.trim()) rule.bypassUrlPatterns = bypassUrls.split(/\s*,\s*/).filter(Boolean)
  if (bypassTypes.trim()) rule.bypassResourceTypes = bypassTypes.split(/\s*,\s*/).filter(Boolean)
  if (staticExt.trim()) rule.staticExtensions = staticExt.trim()
  if (forceUrls.trim()) rule.forceProxyUrlPatterns = forceUrls.split(/\s*,\s*/).filter(Boolean)
  if (fbDirect) rule.fallbackDirect = true

  if (editingRuleIndex !== null) {
    config.rules[editingRuleIndex] = rule as any
  } else {
    config.rules.push(rule as any)
  }

  saveConfig(config).then(() => { renderAll(); closeRuleModal() })
}

function renderOverrides () {
  const tbody = document.querySelector('#overrideTable tbody') as HTMLElement
  tbody.innerHTML = ''
  for (const [domain, proxyId] of Object.entries(config.perWebsiteOverride)) {
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${domain}</td><td>${proxyId}</td>` +
      `<td><button data-domain="${domain}">Delete</button></td>`
    tbody.appendChild(tr)
    const btn = tr.querySelector('button') as HTMLButtonElement
    btn.onclick = () => {
      delete config.perWebsiteOverride[domain]
      saveConfig(config).then(renderAll)
    }
  }
}

function addOverride () {
  const domain = prompt('Domain')
  if (!domain) return
  const proxyId = prompt('Proxy id')
  if (!proxyId) return
  config.perWebsiteOverride[domain] = proxyId
  saveConfig(config).then(renderAll)
}

function renderKeepAlive () {
  const container = document.getElementById('keepAliveContainer') as HTMLElement
  container.innerHTML = ''
  for (const [proxyId, rule] of Object.entries(config.keepAliveRules || {})) {
    const div = document.createElement('div')
    div.innerHTML = `<strong>${proxyId}</strong> ` +
      `<label>Active <input type="checkbox" ${rule.active ? 'checked' : ''}></label> ` +
      `<span>Patterns: ${rule.tabUrls.join(', ')}</span>`
    container.appendChild(div)
    const chk = div.querySelector('input') as HTMLInputElement
    chk.onchange = () => {
      rule.active = chk.checked
      saveConfig(config)
    }
  }
}

function exportRules (rules: ProxyRule[]) {
  const data = JSON.stringify(rules, null, 2)
  download('rules.json', data)
}

function exportAllRules () {
  exportRules(config.rules)
}

function exportSelectedRules () {
  const arr = Array.from(selectedRules).map(i => config.rules[i])
  if (arr.length === 0) {
    exportAllRules()
  } else {
    exportRules(arr)
  }
}

function handleImportRules (files: FileList | null) {
  if (!files || !files[0]) return
  files[0].text().then(t => {
    try {
      const parsed = JSON.parse(t)
      const arr = Array.isArray(parsed) ? parsed as ProxyRule[] : [parsed as ProxyRule]
      config.rules.push(...arr)
      saveConfig(config).then(renderAll)
    } catch (e) {
      console.error(e)
    }
  })
}

function exportConfig () {
  const data = JSON.stringify(config, null, 2)
  download('config.json', data)
}

function handleImportConfig (files: FileList | null) {
  if (!files || !files[0]) return
  files[0].text().then(t => {
    try {
      const obj = JSON.parse(t)
      saveConfig(obj).then(() => { config = obj; renderAll() })
    } catch (e) { console.error(e) }
  })
}

function download (filename: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function renderHierarchy () {
  const pre = document.getElementById('hierarchy') as HTMLElement
  pre.textContent = `1. Tab proxy\n2. Main site rule\n3. Request domain rule\n4. Default proxy\n5. Direct connection`
}

function renderAll () {
  renderGeneral()
  renderProxyList()
  updatePassHeaderButton()
  renderRules()
  renderKeepAlive()
  renderOverrides()
  renderHierarchy()
}

document.addEventListener('DOMContentLoaded', async () => {
  config = await getConfig()
  renderAll()

  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')!))
  })
  switchTab('general')

  document.getElementById('addProxy')!.addEventListener('click', () => openProxyModal())
  document.getElementById('saveProxy')!.addEventListener('click', saveProxyFromModal)
  document.getElementById('cancelProxy')!.addEventListener('click', closeProxyModal)
  document.getElementById('togglePassColumn')!.addEventListener('click', () => {
    revealAllPasswords = !revealAllPasswords
    revealedPasswords.clear()
    renderProxyList()
    updatePassHeaderButton()
  })
  document.getElementById('addRule')!.addEventListener('click', addRule)
  document.getElementById('addOverride')!.addEventListener('click', addOverride)
  document.getElementById('exportRulesSelected')!.addEventListener('click', exportSelectedRules)
  document.getElementById('exportRulesAll')!.addEventListener('click', exportAllRules)
  document.getElementById('importRulesBtn')!.addEventListener('click', () =>
    document.getElementById('importRules')!.click())
  document.getElementById('importRules')!.addEventListener('change', ev =>
    handleImportRules((ev.target as HTMLInputElement).files))
  document.getElementById('exportConfig')!.addEventListener('click', exportConfig)
  document.getElementById('importConfigBtn')!.addEventListener('click', () =>
    document.getElementById('importConfig')!.click())
  document.getElementById('importConfig')!.addEventListener('change', ev =>
    handleImportConfig((ev.target as HTMLInputElement).files))
  document.getElementById('saveRule')!.addEventListener('click', saveRuleFromModal)
  document.getElementById('cancelRule')!.addEventListener('click', closeRuleModal)
  document.getElementById('editRuleMatch')!.addEventListener('click', () => openListModal('ruleMatch', 'Match Patterns', validatePattern))
  document.getElementById('editRuleBypassUrls')!.addEventListener('click', () => openListModal('ruleBypassUrls', 'Bypass URL Patterns', validatePattern))
  document.getElementById('editRuleForceUrls')!.addEventListener('click', () => openListModal('ruleForceUrls', 'Force Proxy URL Patterns', validatePattern))
  document.getElementById('editRuleBypassTypes')!.addEventListener('click', () => openTypeModal('ruleBypassTypes'))
  document.getElementById('addListItem')!.addEventListener('click', () => {
    const container = document.getElementById('listModalItems')!
    addListItem(container)
  })
  document.getElementById('saveList')!.addEventListener('click', saveListModal)
  document.getElementById('cancelList')!.addEventListener('click', closeListModal)
  document.getElementById('saveTypes')!.addEventListener('click', saveTypeModal)
  document.getElementById('cancelTypes')!.addEventListener('click', closeTypeModal)
})
