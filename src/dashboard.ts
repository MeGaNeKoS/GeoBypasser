import {
  compileRules,
  getConfig,
  getTourShown,
  saveConfig,
  saveTabProxyMap,
  setTourShown,
  updateConfig,
} from '@utils/storage'
import { WEB_REQUEST_RESOURCE_TYPES, WebRequestResourceType } from '@constant/requestTypes'
import { KeepAliveProxyRule, ProxyListItem, ProxyRule, RuntimeProxyRule } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { testProxyConfigQueued } from '@utils/proxy'
import { matchPattern } from 'browser-extension-url-match'
import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import { ProxyType } from '@customTypes/generic'
import type { GeoBypassSettings } from '@customTypes/settings'
import { formatBytes, NetworkStats, NetworkStatsNode } from '@utils/network'
import { KeepAliveProxyRuleSchema, ProxyListItemSchema, ProxyRuleSchema } from '@schemas/proxy'
import { GeoBypassSettingsSchema } from '@schemas/settings'
import { z } from 'zod'
import { ProxyIdSchema } from '@schemas/generic'

let config: Awaited<ReturnType<typeof getConfig>>
let editingProxyIndex: number | null = null
let editingRuleIndex: number | null = null
let revealAllPasswords = false
const revealedPasswords = new Set<number>()
const selectedRules = new Set<number>()
const selectedProxies = new Set<number>()
const selectedOverrides = new Set<string>()
const selectedKeepAlive = new Set<string>()
let listTargetInput: HTMLInputElement | null = null
let currentListValidator: (val: string) => boolean = () => true
let typeTargetInput: HTMLInputElement | null = null
let editingKeepAliveId: string | null = null
const activeRows = new WeakMap<HTMLTableElement, HTMLTableRowElement | null>()
let networkAutoInterval: ReturnType<typeof setInterval> | null = null

// Helper to generate a signature for comparing proxy entries

function proxySignature (p: ProxyListItem) {
  return `${p.type}-${p.host}:${p.port}-${p.username || ''}`
}

function switchTab (id: string) {
  document.querySelectorAll('section.tab').forEach(sec => sec.classList.remove('active'))
  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === id)
  })
  const el = document.getElementById(id)
  if (el) el.classList.add('active')
  const activeBtn = document.querySelector(`#tabs button[data-tab="${id}"]`) as HTMLButtonElement | null
  const navToggle = document.getElementById('navToggle') as HTMLButtonElement | null
  if (activeBtn && navToggle) navToggle.textContent = activeBtn.textContent || id
  if (window.innerWidth <= 600) {
    document.getElementById('tabs')?.classList.remove('open')
    navToggle?.classList.remove('open')
  }
  if (id === 'network') {
    renderNetwork()
  }
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

function attachRowHandlers (
  tr: HTMLTableRowElement,
  table: HTMLTableElement,
  exportBtn: HTMLElement,
  deleteBtn?: HTMLElement,
) {
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  let timer: number | null = null

  function openActions () {
    const prev = activeRows.get(table)
    if (prev && prev !== tr) prev.classList.remove('show-actions')
    activeRows.set(table, tr)
    tr.classList.add('show-actions')
    table.dataset.showActions = 'true'
    table.dataset.showSelect = 'true'
    exportBtn.style.display = 'inline-block'
    if (deleteBtn) deleteBtn.style.display = 'inline-block'
  }

  function closeActions () {
    tr.classList.remove('show-actions')
    if (activeRows.get(table) === tr) activeRows.set(table, null)
    updateSelectVisibility(table, exportBtn, deleteBtn)
  }

  function showSelectOnly () {
    table.dataset.showSelect = 'true'
    exportBtn.style.display = 'inline-block'
    if (deleteBtn) deleteBtn.style.display = 'inline-block'
  }

  if (isTouch) {
    tr.addEventListener('touchstart', () => {
      timer = window.setTimeout(() => {
        openActions()
        timer = null
      }, 500)
    })
    tr.addEventListener('touchend', () => {
      if (timer !== null) {
        clearTimeout(timer)
        if (tr.classList.contains('show-actions')) {
          closeActions()
        } else if (table.dataset.showSelect) {
          updateSelectVisibility(table, exportBtn, deleteBtn)
        } else {
          showSelectOnly()
        }
      }
    })
  } else {
    tr.addEventListener('click', ev => {
      if ((ev.target as HTMLElement).closest('button,input')) return
      if (tr.classList.contains('show-actions')) {
        closeActions()
      } else {
        openActions()
      }
    })
  }
}

function updateSelectVisibility (
  table: HTMLTableElement,
  exportBtn: HTMLElement,
  deleteBtn?: HTMLElement,
) {
  const anyChecked = table.querySelectorAll('td.row-select input:checked').length > 0
  const anyActions = table.querySelector('tr.show-actions')
  if (anyChecked || anyActions) {
    table.dataset.showSelect = 'true'
    exportBtn.style.display = 'inline-block'
    if (deleteBtn) deleteBtn.style.display = 'inline-block'
  } else {
    delete table.dataset.showSelect
    exportBtn.style.display = 'none'
    if (deleteBtn) deleteBtn.style.display = 'none'
  }
  if (!anyActions) delete table.dataset.showActions
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
  return val.split(/\s*,\s*/).filter(Boolean).every(
    v => WEB_REQUEST_RESOURCE_TYPES.includes(v as WebRequestResourceType))
}

function validateRegExp (val: string) {
  if (!val.trim()) return true
  const m = val.match(/^\/(.*)\/([gimsuy]*)$/)
  if (!m) return false
  try { new RegExp(m[1], m[2]) } catch { return false }
  return true
}

function validateDomain (val: string) {
  let urlString = val.trim()

  // If there's no protocol, add one
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(urlString)) {
    urlString = 'https://' + urlString
  }

  try {
    new URL(urlString)
    return true
  } catch (e) {
    console.error('Invalid URL:', e)
    return false
  }
}

function validateHostnamePattern (val: string) {
  const trimmed = val.trim()
  if (trimmed.startsWith('*.')) {
    const domain = trimmed.slice(2)
    return /^[a-zA-Z0-9.-]+$/.test(domain)
  }
  return /^[a-zA-Z0-9.-]+$/.test(trimmed)
}

function isRuleInvalid (r: RuntimeProxyRule) {
  if (!r.compiledMatch) return true
  if (r.bypassUrlPatterns && r.bypassUrlPatterns.length && !r.compiledBypassUrlPatterns) return true
  if (r.forceProxyUrlPatterns && r.forceProxyUrlPatterns.length && !r.compiledForceProxyUrlPatterns) return true
  if (r.staticExtensions && r.staticExtensions.trim() && !r.compiledStaticExtensions) return true
  return false
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

interface ListHelp {
  href?: string;
  title?: string;
}

function openListModal (inputId: string, title: string, validator: (v: string) => boolean, help?: ListHelp) {
  listTargetInput = document.getElementById(inputId) as HTMLInputElement
  currentListValidator = validator
  const modal = document.getElementById('listModal')!
  const heading = document.getElementById('listModalTitle')!
  const container = document.getElementById('listModalItems')!
  const helpEl = document.getElementById('listModalHelp') as HTMLAnchorElement
  heading.textContent = title
  container.innerHTML = ''
  if (help) {
    if (help.href) {
      helpEl.href = help.href
      helpEl.target = '_blank'
    } else {
      helpEl.removeAttribute('href')
      helpEl.removeAttribute('target')
    }
    if (help.title) helpEl.title = help.title
    else helpEl.removeAttribute('title')
    helpEl.classList.remove('hidden')
  } else {
    helpEl.classList.add('hidden')
  }
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

function showDuplicateModal (name: string): Promise<'old' | 'new' | 'both'> {
  const modal = document.getElementById('duplicateModal')!
  const msg = document.getElementById('duplicateMessage')!
  const keepOld = document.getElementById('duplicateKeepOld')!
  const keepNew = document.getElementById('duplicateKeepNew')!
  const keepBoth = document.getElementById('duplicateKeepBoth')!

  msg.textContent = `Duplicate item "${name}" found.`
  modal.classList.remove('hidden')

  return new Promise(resolve => {
    function cleanup (value: 'old' | 'new' | 'both') {
      keepOld.removeEventListener('click', onOld)
      keepNew.removeEventListener('click', onNew)
      keepBoth.removeEventListener('click', onBoth)
      modal.classList.add('hidden')
      resolve(value)
    }

    function onOld () { cleanup('old') }

    function onNew () { cleanup('new') }

    function onBoth () { cleanup('both') }

    keepOld.addEventListener('click', onOld)
    keepNew.addEventListener('click', onNew)
    keepBoth.addEventListener('click', onBoth)
  })
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

    const labelCell = document.createElement('td')
    labelCell.textContent = p.label || p.host
    tr.appendChild(labelCell)

    const typeCell = document.createElement('td')
    typeCell.textContent = p.type === 'socks' ? 'socks5' : p.type
    tr.appendChild(typeCell)

    const hostCell = document.createElement('td')
    hostCell.textContent = p.host
    tr.appendChild(hostCell)

    const portCell = document.createElement('td')
    portCell.textContent = String(p.port)
    tr.appendChild(portCell)

    const userCell = document.createElement('td')
    userCell.textContent = p.username || ''
    tr.appendChild(userCell)

    const passCell = document.createElement('td')
    passCell.className = 'password'
    passCell.textContent = p.password ? (visible ? p.password : '******') : ''
    tr.appendChild(passCell)

    const notifyCell = document.createElement('td')
    const notifyChk = document.createElement('input')
    notifyChk.type = 'checkbox'
    notifyChk.dataset.notify = ''
    notifyChk.checked = !!p.notifyIfDown
    notifyCell.appendChild(notifyChk)
    tr.appendChild(notifyCell)

    const selectCell = document.createElement('td')
    selectCell.className = 'row-select'
    const selChk = document.createElement('input')
    selChk.type = 'checkbox'
    selChk.dataset.select = String(idx)
    selectCell.appendChild(selChk)
    tr.appendChild(selectCell)

    const actionsCell = document.createElement('td')
    actionsCell.className = 'row-actions'
    const editBtn = document.createElement('button')
    editBtn.dataset.edit = String(idx)
    editBtn.textContent = 'Edit'
    const delBtn = document.createElement('button')
    delBtn.dataset.remove = String(idx)
    delBtn.textContent = 'Delete'
    actionsCell.appendChild(editBtn)
    actionsCell.appendChild(delBtn)
    tr.appendChild(actionsCell)

    tbody.appendChild(tr)
    // attachRowHandlers(tr, document.getElementById('proxyTable') as HTMLTableElement,
    //   document.getElementById('exportProxiesSelected') as HTMLElement)

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

    notifyChk.onchange = () => {
      p.notifyIfDown = notifyChk.checked
      saveConfig(config)
    }
    selChk.onchange = () => {
      if (selChk.checked) selectedProxies.add(idx)
      else selectedProxies.delete(idx)
      updateSelectVisibility(
        document.getElementById('proxyTable') as HTMLTableElement,
        document.getElementById('exportProxiesSelected') as HTMLElement,
        document.getElementById('deleteProxiesSelected') as HTMLElement,
      )
    }
    editBtn.onclick = () => openProxyModal(idx)
    delBtn.onclick = () => {
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
  const type = (document.getElementById('proxyType') as HTMLSelectElement).value as ProxyType
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

  saveConfig(config).then(() => {
    renderAll()
    closeProxyModal()
  })
}

function renderRules () {
  const tbody = document.querySelector('#ruleTable tbody') as HTMLElement
  tbody.innerHTML = ''
  config.rules.forEach((r, idx) => {
    const tr = document.createElement('tr')
    const proxy = config.proxyList.find(p => p.id === r.proxyId)
    const proxyLabel = r.proxyId === DIRECT_PROXY_ID
      ? 'Direct'
      : proxy
        ? (proxy.label || proxy.host)
        : r.proxyId

    const activeCell = document.createElement('td')
    const activeChk = document.createElement('input')
    activeChk.type = 'checkbox'
    activeChk.dataset.active = ''
    activeChk.checked = !!r.active
    activeCell.appendChild(activeChk)
    tr.appendChild(activeCell)

    const nameCell = document.createElement('td')
    nameCell.textContent = r.name
    tr.appendChild(nameCell)

    const matchCell = document.createElement('td')
    matchCell.textContent = r.match.join(', ')
    tr.appendChild(matchCell)

    const proxyCell = document.createElement('td')
    proxyCell.textContent = proxyLabel
    tr.appendChild(proxyCell)

    const selectCell = document.createElement('td')
    selectCell.className = 'row-select'
    const selChk = document.createElement('input')
    selChk.type = 'checkbox'
    selChk.dataset.select = String(idx)
    selectCell.appendChild(selChk)
    tr.appendChild(selectCell)

    const actionsCell = document.createElement('td')
    actionsCell.className = 'row-actions'
    const editBtn = document.createElement('button')
    editBtn.dataset.edit = String(idx)
    editBtn.textContent = 'Edit'
    const delBtn = document.createElement('button')
    delBtn.dataset.remove = String(idx)
    delBtn.textContent = 'Delete'
    const expBtn = document.createElement('button')
    expBtn.dataset.export = String(idx)
    expBtn.textContent = 'Export'
    actionsCell.appendChild(editBtn)
    actionsCell.appendChild(delBtn)
    actionsCell.appendChild(expBtn)
    tr.appendChild(actionsCell)
    if (!proxy) tr.classList.add('missing-proxy')
    if (isRuleInvalid(r)) tr.classList.add('invalid-rule')
    tbody.appendChild(tr)
    // attachRowHandlers(tr, document.getElementById('ruleTable') as HTMLTableElement,
    //   document.getElementById('exportRulesSelected') as HTMLElement)
    activeChk.onchange = () => {
      r.active = activeChk.checked
      saveConfig(config)
    }
    selChk.onchange = () => {
      if (selChk.checked) selectedRules.add(idx)
      else selectedRules.delete(idx)
      updateSelectVisibility(
        document.getElementById('ruleTable') as HTMLTableElement,
        document.getElementById('exportRulesSelected') as HTMLElement,
        document.getElementById('deleteRulesSelected') as HTMLElement,
      )
    }
    editBtn.onclick = () => openRuleModal(idx)
    delBtn.onclick = () => {
      config.rules.splice(idx, 1)
      saveConfig(config).then(renderAll)
    }
    expBtn.onclick = () => exportRules([r])
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
  proxy.appendChild(createOption(DIRECT_PROXY_ID, 'Direct'))
  config.proxyList.forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))
  const kaExists = editingKeepAliveId ? config.proxyList.some(p => p.id === editingKeepAliveId) : false
  if (editingKeepAliveId && !kaExists) {
    proxy.appendChild(createOption(editingKeepAliveId, `Missing Proxy (${editingKeepAliveId})`))
  }

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

  const compiled = compileRules([rule])[0]
  if (editingRuleIndex !== null) {
    config.rules[editingRuleIndex] = compiled
  } else {
    config.rules.push(compiled)
  }

  saveConfig(config).then(() => {
    renderAll()
    closeRuleModal()
  })
}

function renderOverrides () {
  const tbody = document.querySelector('#overrideTable tbody') as HTMLElement
  tbody.innerHTML = ''
  for (const [domain, proxyId] of Object.entries(config.perWebsiteOverride)) {
    const proxy = config.proxyList.find(p => p.id === proxyId)
    const proxyLabel = proxy ? (proxy.label || proxy.host) : proxyId
    const tr = document.createElement('tr')
    const domainCell = document.createElement('td')
    domainCell.textContent = domain
    tr.appendChild(domainCell)

    const proxyCell = document.createElement('td')
    proxyCell.textContent = proxyLabel
    tr.appendChild(proxyCell)

    const selectCell = document.createElement('td')
    selectCell.className = 'row-select'
    const selChk = document.createElement('input')
    selChk.type = 'checkbox'
    selChk.dataset.select = domain
    selectCell.appendChild(selChk)
    tr.appendChild(selectCell)

    const actionsCell = document.createElement('td')
    actionsCell.className = 'row-actions'
    const delBtn = document.createElement('button')
    delBtn.dataset.domain = domain
    delBtn.textContent = 'Delete'
    actionsCell.appendChild(delBtn)
    tr.appendChild(actionsCell)

    tbody.appendChild(tr)
    // attachRowHandlers(tr, document.getElementById('overrideTable') as HTMLTableElement,
    //   document.getElementById('exportOverridesSelected') as HTMLElement)
    delBtn.onclick = () => {
      delete config.perWebsiteOverride[domain]
      saveConfig(config).then(renderAll)
    }
    selChk.onchange = () => {
      if (selChk.checked) selectedOverrides.add(domain)
      else selectedOverrides.delete(domain)
      updateSelectVisibility(
        document.getElementById('overrideTable') as HTMLTableElement,
        document.getElementById('exportOverridesSelected') as HTMLElement,
        document.getElementById('deleteOverridesSelected') as HTMLElement,
      )
    }
  }
}

function openOverrideModal () {
  const modal = document.getElementById('overrideModal')!
  const domain = document.getElementById('overrideDomain') as HTMLInputElement
  const proxy = document.getElementById('overrideProxy') as HTMLSelectElement
  domain.value = ''
  proxy.innerHTML = ''
  config.proxyList.forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))
  proxy.value = config.proxyList[0]?.id || ''
  setValidation(domain, validateDomain)
  modal.classList.remove('hidden')
}

function closeOverrideModal () {
  document.getElementById('overrideModal')!.classList.add('hidden')
}

function saveOverrideFromModal () {
  const domain = (document.getElementById('overrideDomain') as HTMLInputElement).value.trim()
  const proxyId = (document.getElementById('overrideProxy') as HTMLSelectElement).value
  if (!validateDomain(domain) || !proxyId) return
  config.perWebsiteOverride[domain] = proxyId
  saveConfig(config).then(() => {
    renderAll()
    closeOverrideModal()
  })
}

function openKeepAliveModal (id?: string) {
  editingKeepAliveId = typeof id === 'string' ? id : null
  const modal = document.getElementById('keepAliveModal')!
  const title = document.getElementById('keepAliveModalTitle')!
  const proxy = document.getElementById('keepAliveProxy') as HTMLSelectElement
  const patterns = document.getElementById('keepAlivePatterns') as HTMLInputElement
  const testUrl = document.getElementById('keepAliveTestUrl') as HTMLInputElement
  const active = document.getElementById('keepAliveActive') as HTMLInputElement

  proxy.innerHTML = ''
  config.proxyList.forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))
  const kaExists = editingKeepAliveId ? config.proxyList.some(p => p.id === editingKeepAliveId) : false
  if (editingKeepAliveId && !kaExists) {
    proxy.appendChild(createOption(editingKeepAliveId, `Missing Proxy (${editingKeepAliveId})`))
  }

  if (editingKeepAliveId) {
    const rule = config.keepAliveRules?.[editingKeepAliveId]
    title.textContent = 'Edit Keep-Alive Rule'
    proxy.value = editingKeepAliveId
    patterns.value = rule?.tabUrls.join(', ') || ''
    testUrl.value = rule?.testProxyUrl || ''
    active.checked = !!rule?.active
  } else {
    title.textContent = 'Add Keep-Alive Rule'
    proxy.value = config.proxyList[0]?.id || ''
    patterns.value = ''
    testUrl.value = ''
    active.checked = true
  }
  updateListDisplay(patterns)
  setValidation(patterns, validateHostnamePattern)
  modal.classList.remove('hidden')
}

function closeKeepAliveModal () {
  document.getElementById('keepAliveModal')!.classList.add('hidden')
}

function saveKeepAliveFromModal () {
  const proxyId = (document.getElementById('keepAliveProxy') as HTMLSelectElement).value
  const patterns = (document.getElementById('keepAlivePatterns') as HTMLInputElement).value.split(/\s*,\s*/).filter(
    Boolean)
  const testUrl = (document.getElementById('keepAliveTestUrl') as HTMLInputElement).value.trim()
  const active = (document.getElementById('keepAliveActive') as HTMLInputElement).checked
  if (!proxyId || patterns.length === 0) return
  if (!config.keepAliveRules) config.keepAliveRules = {}
  const rule: { active: boolean; tabUrls: string[]; testProxyUrl?: string } = { active, tabUrls: patterns }
  if (testUrl) rule.testProxyUrl = testUrl
  if (editingKeepAliveId && editingKeepAliveId !== proxyId) {
    delete config.keepAliveRules[editingKeepAliveId]
  }
  config.keepAliveRules[proxyId] = rule
  saveConfig(config).then(() => {
    renderAll()
    closeKeepAliveModal()
  })
}

function renderKeepAlive () {
  const tbody = document.querySelector('#keepAliveTable tbody') as HTMLElement
  tbody.innerHTML = ''
  for (const [proxyId, rule] of Object.entries(config.keepAliveRules || {})) {
    const tr = document.createElement('tr')
    const proxy = config.proxyList.find(p => p.id === proxyId)
    const proxyLabel = proxy ? (proxy.label || proxy.host) : proxyId

    const activeCell = document.createElement('td')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.dataset.active = ''
    chk.checked = rule.active
    activeCell.appendChild(chk)
    tr.appendChild(activeCell)

    const proxyCell = document.createElement('td')
    proxyCell.textContent = proxyLabel
    tr.appendChild(proxyCell)

    const urlsCell = document.createElement('td')
    urlsCell.textContent = rule.tabUrls.join(', ')
    tr.appendChild(urlsCell)

    const testCell = document.createElement('td')
    testCell.textContent = rule.testProxyUrl || ''
    tr.appendChild(testCell)

    const selectCell = document.createElement('td')
    selectCell.className = 'row-select'
    const selChk = document.createElement('input')
    selChk.type = 'checkbox'
    selChk.dataset.select = proxyId
    selectCell.appendChild(selChk)
    tr.appendChild(selectCell)

    const actionsCell = document.createElement('td')
    actionsCell.className = 'row-actions'
    const editBtn = document.createElement('button')
    editBtn.dataset.edit = proxyId
    editBtn.textContent = 'Edit'
    const delBtn = document.createElement('button')
    delBtn.dataset.remove = proxyId
    delBtn.textContent = 'Delete'
    actionsCell.appendChild(editBtn)
    actionsCell.appendChild(delBtn)
    tr.appendChild(actionsCell)

    if (!proxy) tr.classList.add('missing-proxy')
    tbody.appendChild(tr)
    // attachRowHandlers(tr, document.getElementById('keepAliveTable') as HTMLTableElement,
    //   document.getElementById('exportKeepAliveSelected') as HTMLElement)
    chk.onchange = () => {
      rule.active = chk.checked
      saveConfig(config)
    }
    selChk.onchange = () => {
      if (selChk.checked) selectedKeepAlive.add(proxyId)
      else selectedKeepAlive.delete(proxyId)
      updateSelectVisibility(
        document.getElementById('keepAliveTable') as HTMLTableElement,
        document.getElementById('exportKeepAliveSelected') as HTMLElement,
        document.getElementById('deleteKeepAliveSelected') as HTMLElement,
      )
    }
    editBtn.onclick = () => openKeepAliveModal(proxyId)
    delBtn.onclick = () => {
      delete config.keepAliveRules?.[proxyId]
      saveConfig(config).then(renderAll)
    }
  }
}

function stripRule (r: RuntimeProxyRule, keepProxyId = true): ProxyRule {
  return {
    active: typeof r.active === 'undefined' ? true : r.active,
    proxyId: keepProxyId ? r.proxyId : DIRECT_PROXY_ID,
    name: r.name,
    match: r.match,
    bypassUrlPatterns: r.bypassUrlPatterns,
    bypassResourceTypes: r.bypassResourceTypes,
    staticExtensions: r.staticExtensions,
    forceProxyUrlPatterns: r.forceProxyUrlPatterns,
    fallbackDirect: r.fallbackDirect,
  }
}

function getExportableConfig () {
  return {
    proxyList: config.proxyList,
    defaultProxy: config.defaultProxy,
    fallbackDirect: config.fallbackDirect,
    rules: config.rules.map(rule => stripRule(rule, true)),
    keepAliveRules: config.keepAliveRules,
    testProxyUrl: config.testProxyUrl,
    perWebsiteOverride: config.perWebsiteOverride,
  }
}

async function mergeConfigData (cfg: Partial<GeoBypassSettings>) {
  const base = getExportableConfig()
  const updated: GeoBypassSettings = {
    proxyList: [...base.proxyList],
    defaultProxy: cfg.defaultProxy ?? base.defaultProxy,
    fallbackDirect: cfg.fallbackDirect ?? base.fallbackDirect,
    testProxyUrl: cfg.testProxyUrl ?? base.testProxyUrl,
    rules: Array.isArray(cfg.rules) ? [...base.rules] : base.rules,
    keepAliveRules: cfg.keepAliveRules ?? base.keepAliveRules,
    perWebsiteOverride: { ...base.perWebsiteOverride, ...cfg.perWebsiteOverride },
  }

  const idMap = new Map<string, string>()

  if (cfg.proxyList) {
    const existing = new Map(updated.proxyList.map((p, idx) => [proxySignature(p), idx]))
    for (const p of cfg.proxyList as ProxyListItem[]) {
      const sig = proxySignature(p)
      if (existing.has(sig)) {
        const idx = existing.get(sig)!
        const choice = await showDuplicateModal(`${p.host}:${p.port}`)
        const target = updated.proxyList[idx]
        if (choice === 'new') {
          updated.proxyList[idx] = { ...p, id: target.id }
          idMap.set(p.id, target.id)
        } else if (choice === 'both') {
          const np = { ...p, id: crypto.randomUUID() }
          if (np.label) np.label += ' (copy)'
          updated.proxyList.push(np)
          idMap.set(p.id, np.id)
        } else {
          idMap.set(p.id, target.id)
        }
      } else {
        existing.set(sig, updated.proxyList.length)
        updated.proxyList.push(p)
        idMap.set(p.id, p.id)
      }
    }
  }

  if (cfg.defaultProxy) {
    updated.defaultProxy = idMap.get(cfg.defaultProxy) ?? cfg.defaultProxy
  }

  if (cfg.rules && Array.isArray(cfg.rules)) {
    const mappedRules = cfg.rules.map((r: ProxyRule) => ({
      ...r,
      proxyId: idMap.get(r.proxyId) ?? r.proxyId,
    }))
    updated.rules = [...updated.rules, ...mappedRules]
  }

  if (cfg.perWebsiteOverride) {
    for (const [domain, pid] of Object.entries(cfg.perWebsiteOverride as Record<string, string>)) {
      updated.perWebsiteOverride[domain] = idMap.get(pid) ?? pid
    }
  }

  if (cfg.keepAliveRules) {
    updated.keepAliveRules = { ...(base.keepAliveRules || {}) }
    for (const [pid, rule] of Object.entries(
      cfg.keepAliveRules as Record<string, { active: boolean; tabUrls: string[]; testProxyUrl?: string }>)) {
      const mappedId = idMap.get(pid) ?? pid
      updated.keepAliveRules[mappedId] = rule
    }
  }

  await saveConfig(updated)
  config = await getConfig()
  renderAll()
}

async function importConfigObject (obj: unknown) {
  const parsed = GeoBypassSettingsSchema.partial().safeParse(obj)
  if (!parsed.success) {
    console.error('Invalid config data:', parsed.error)
    alert('Invalid config file: schema validation failed.')
    return
  }

  await mergeConfigData(parsed.data)
}

async function importConfigFromUrl (url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const obj = await res.json()
    await importConfigObject(obj)
  } catch (err) {
    console.error('Failed to import from URL:', err)
    alert('Failed to import configuration from URL.')
  }
}

async function fetchGitHubFileList (owner: string, repo: string, prefix = ''): Promise<{
  path: string;
  url: string;
}[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    const res = await fetch(apiUrl)
    if (!res.ok) throw new Error('Failed to fetch file list')
    const data = await res.json() as { tree?: Array<{ path: string; type: string }> }
    const files: { path: string; url: string }[] = []
    const pref = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''
    for (const entry of data.tree || []) {
      if (entry.type === 'blob' && entry.path.endsWith('.json') && entry.path.startsWith(pref)) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${entry.path}`
        files.push({ path: entry.path.slice(pref.length), url: rawUrl })
      }
    }
    return files
  } catch (err) {
    console.error('Failed to fetch GitHub file list:', err)
    return []
  }
}

function openRemoteImportModal (owner: string, repo: string, prefix = '') {
  const modal = document.getElementById('remoteImportModal')!
  const container = document.getElementById('remoteFileTree')!
  container.innerHTML = 'Loading...'
  fetchGitHubFileList(owner, repo, prefix).then(files => {
    container.innerHTML = ''
    files.forEach(f => {
      const label = document.createElement('label')
      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.value = f.url
      chk.checked = true
      label.appendChild(chk)
      label.append(' ', f.path)
      container.appendChild(label)
      container.appendChild(document.createElement('br'))
    })
  })
  modal.classList.remove('hidden')
}

function closeRemoteImportModal () {
  document.getElementById('remoteImportModal')?.classList.add('hidden')
}

function remoteSelectAll () {
  document.querySelectorAll('#remoteFileTree input[type="checkbox"]').forEach(el => {
    (el as HTMLInputElement).checked = true
  })
}

async function confirmRemoteImport () {
  const urls = Array.from(document.querySelectorAll('#remoteFileTree input[type="checkbox"]')).filter(
    el => (el as HTMLInputElement).checked).map(el => (el as HTMLInputElement).value)
  for (const url of urls) {
    await importConfigFromUrl(url)
  }
  closeRemoteImportModal()
}

function exportRules (rules: RuntimeProxyRule[]) {
  const sanitized = rules.map(r => stripRule(r, false))
  const data = JSON.stringify({ rules: sanitized }, null, 2)
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

function deleteSelectedRules () {
  const idxs = Array.from(selectedRules).sort((a, b) => b - a)
  idxs.forEach(i => { config.rules.splice(i, 1) })
  selectedRules.clear()
  saveConfig(config).then(renderAll)
}

function handleImportRules (files: FileList | null) {
  if (!files || !files[0]) return

  files[0].text().then(t => {
    try {
      const raw = JSON.parse(t)
      const arr = raw?.rules

      const result = z.array(ProxyRuleSchema).safeParse(arr)

      if (!result.success) {
        console.error('Invalid proxy rules:', result.error)
        alert('Invalid rule file: schema validation failed.')
        return
      }

      const compiled = compileRules(result.data)
      config.rules.push(...compiled)
      saveConfig(config).then(renderAll)

    } catch (e) {
      console.error('Error importing proxy rules:', e)
      alert('Failed to import rules: invalid JSON')
    }
  })
}

function exportProxies (list: ProxyListItem[]) {
  download('proxies.json', JSON.stringify({ proxyList: list }, null, 2))
}

function exportAllProxies () {
  exportProxies(config.proxyList)
}

function exportSelectedProxies () {
  const arr = Array.from(selectedProxies).map(i => config.proxyList[i])
  if (arr.length === 0) exportAllProxies()
  else exportProxies(arr)
}

function deleteSelectedProxies () {
  const idxs = Array.from(selectedProxies).sort((a, b) => b - a)
  idxs.forEach(i => { config.proxyList.splice(i, 1) })
  selectedProxies.clear()
  saveConfig(config).then(renderAll)
}

function handleImportProxies (files: FileList | null) {
  if (!files || !files[0]) return

  files[0].text().then(async t => {
    try {
      const raw = JSON.parse(t)
      const list = raw?.proxyList

      const result = z.array(ProxyListItemSchema).safeParse(list)

      if (!result.success) {
        console.error('Invalid proxy list items:', result.error)
        alert('Invalid proxy file: schema validation failed.')
        return
      }

      const arr = result.data
      const existing = new Map(config.proxyList.map((p, idx) => [proxySignature(p), idx]))

      for (const p of arr) {
        const sig = proxySignature(p)
        if (existing.has(sig)) {
          const idx = existing.get(sig)!
          const choice = await showDuplicateModal(`${p.host}:${p.port}`)
          const target = config.proxyList[idx]
          if (choice === 'new') {
            config.proxyList[idx] = { ...p, id: target.id }
          } else if (choice === 'both') {
            const np = { ...p, id: crypto.randomUUID() }
            if (np.label) np.label += ' (copy)'
            existing.set(proxySignature(np), config.proxyList.length)
            config.proxyList.push(np)
          }
        } else {
          existing.set(sig, config.proxyList.length)
          config.proxyList.push(p)
        }
      }

      saveConfig(config).then(renderAll)
    } catch (e) {
      console.error('Error importing proxies:', e)
      alert('Failed to import proxies: invalid JSON')
    }
  })
}

function exportOverrides (obj: Record<string, string>) {
  download('overrides.json', JSON.stringify({ perWebsiteOverride: obj }, null, 2))
}

function exportAllOverrides () {
  exportOverrides(config.perWebsiteOverride)
}

function exportSelectedOverrides () {
  const out: Record<string, string> = {}
  selectedOverrides.forEach(d => {
    const val = config.perWebsiteOverride[d]
    if (val) out[d] = val
  })
  if (Object.keys(out).length === 0) exportAllOverrides()
  else exportOverrides(out)
}

function deleteSelectedOverrides () {
  selectedOverrides.forEach(domain => {
    delete config.perWebsiteOverride[domain]
  })
  selectedOverrides.clear()
  saveConfig(config).then(renderAll)
}

function handleImportOverrides (files: FileList | null) {
  if (!files || !files[0]) return

  files[0].text().then(t => {
    try {
      const parsed = JSON.parse(t)
      const obj = parsed?.perWebsiteOverride

      const result = z.record(ProxyIdSchema).safeParse(obj)

      if (!result.success) {
        console.error('Invalid override map:', result.error)
        alert('Invalid override file: expected a record of string → ProxyId.')
        return
      }

      Object.assign(config.perWebsiteOverride, result.data)
      saveConfig(config).then(renderAll)

    } catch (e) {
      console.error('Error importing overrides:', e)
      alert('Failed to import overrides: invalid JSON')
    }
  })
}

function exportKeepAlive (obj: KeepAliveProxyRule) {
  download('keepalive.json', JSON.stringify({ keepAliveRules: obj }, null, 2))
}

function exportAllKeepAlive () {
  exportKeepAlive(config.keepAliveRules || {})
}

function exportSelectedKeepAlive () {
  const out: KeepAliveProxyRule = {}
  selectedKeepAlive.forEach(id => {
    const rule = config.keepAliveRules?.[id]
    if (rule) out[id] = rule
  })
  if (Object.keys(out).length === 0) exportAllKeepAlive()
  else exportKeepAlive(out)
}

function deleteSelectedKeepAlive () {
  selectedKeepAlive.forEach(id => {
    delete config.keepAliveRules?.[id]
  })
  selectedKeepAlive.clear()
  saveConfig(config).then(renderAll)
}

function handleImportKeepAlive (files: FileList | null) {
  if (!files || !files[0]) return

  files[0].text().then(t => {
    try {
      const parsed = JSON.parse(t)
      const obj = parsed?.keepAliveRules

      const result = KeepAliveProxyRuleSchema.safeParse(obj)

      if (!result.success) {
        console.error('Invalid keep-alive rules:', result.error)
        alert('Invalid keep-alive file: schema validation failed.')
        return
      }

      if (!config.keepAliveRules) config.keepAliveRules = {}

      Object.assign(config.keepAliveRules, result.data)
      saveConfig(config).then(renderAll)

    } catch (e) {
      console.error('Error importing keep-alive rules:', e)
      alert('Failed to import keep-alive rules: invalid JSON')
    }
  })
}

function openExportConfigModal () {
  const container = document.getElementById('exportConfigItems')!
  container.innerHTML = ''

  const proxiesHeader = document.createElement('h4')
  proxiesHeader.textContent = 'Proxies'
  container.appendChild(proxiesHeader)
  const proxyToggle = document.createElement('button')
  proxyToggle.className = 'sectionToggle'
  proxyToggle.dataset.group = 'proxy'
  proxyToggle.textContent = 'Select All'
  container.appendChild(proxyToggle)
  container.appendChild(document.createElement('br'))
  config.proxyList.forEach((p, idx) => {
    const label = document.createElement('label')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.value = String(idx)
    chk.dataset.group = 'proxy'
    chk.checked = true
    chk.addEventListener('change', () => {
      updateExportToggleLabel('proxy')
      updateExportSelectAllLabel()
    })
    label.appendChild(chk)
    label.append(' ', p.label || p.host)
    container.appendChild(label)
    container.appendChild(document.createElement('br'))
  })

  const rulesHeader = document.createElement('h4')
  rulesHeader.textContent = 'Rules'
  container.appendChild(rulesHeader)
  const ruleToggle = document.createElement('button')
  ruleToggle.className = 'sectionToggle'
  ruleToggle.dataset.group = 'rule'
  ruleToggle.textContent = 'Select All'
  container.appendChild(ruleToggle)
  container.appendChild(document.createElement('br'))
  config.rules.forEach((r, idx) => {
    const label = document.createElement('label')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.value = String(idx)
    chk.dataset.group = 'rule'
    chk.checked = true
    chk.addEventListener('change', () => {
      updateExportToggleLabel('rule')
      updateExportSelectAllLabel()
    })
    label.appendChild(chk)
    label.append(' ', r.name)
    container.appendChild(label)
    container.appendChild(document.createElement('br'))
  })

  const ovHeader = document.createElement('h4')
  ovHeader.textContent = 'Overrides'
  container.appendChild(ovHeader)
  const ovToggle = document.createElement('button')
  ovToggle.className = 'sectionToggle'
  ovToggle.dataset.group = 'override'
  ovToggle.textContent = 'Select All'
  container.appendChild(ovToggle)
  container.appendChild(document.createElement('br'))
  for (const domain of Object.keys(config.perWebsiteOverride)) {
    const label = document.createElement('label')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.value = domain
    chk.dataset.group = 'override'
    chk.checked = true
    chk.addEventListener('change', () => {
      updateExportToggleLabel('override')
      updateExportSelectAllLabel()
    })
    label.appendChild(chk)
    label.append(' ', domain)
    container.appendChild(label)
    container.appendChild(document.createElement('br'))
  }

  const kaHeader = document.createElement('h4')
  kaHeader.textContent = 'Keep-Alive'
  container.appendChild(kaHeader)
  const kaToggle = document.createElement('button')
  kaToggle.className = 'sectionToggle'
  kaToggle.dataset.group = 'keepalive'
  kaToggle.textContent = 'Select All'
  container.appendChild(kaToggle)
  container.appendChild(document.createElement('br'))
  for (const proxyId of Object.keys(config.keepAliveRules || {})) {
    const proxy = config.proxyList.find(p => p.id === proxyId)
    const display = proxy ? (proxy.label || proxy.host) : proxyId
    const label = document.createElement('label')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.value = proxyId
    chk.dataset.group = 'keepalive'
    chk.checked = true
    chk.addEventListener('change', () => {
      updateExportToggleLabel('keepalive')
      updateExportSelectAllLabel()
    })
    label.appendChild(chk)
    label.append(' ', display)
    container.appendChild(label)
    container.appendChild(document.createElement('br'))
  }

  container.querySelectorAll('.sectionToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = (btn as HTMLElement).getAttribute('data-group')!
      toggleExportSection(group)
    })
  })

  ;['proxy', 'rule', 'override', 'keepalive'].forEach(updateExportToggleLabel)
  updateExportSelectAllLabel()

  document.getElementById('exportConfigModal')!.classList.remove('hidden')
}

function exportConfigSelectAll () {
  const boxes = document.querySelectorAll('#exportConfigItems input[type="checkbox"]') as NodeListOf<HTMLInputElement>
  const allSelected = Array.from(boxes).every(b => b.checked)
  boxes.forEach(b => { b.checked = !allSelected })
  ;['proxy', 'rule', 'override', 'keepalive'].forEach(updateExportToggleLabel)
  updateExportSelectAllLabel()
}

function toggleExportSection (group: string) {
  const boxes = document.querySelectorAll(
    `#exportConfigItems input[data-group="${group}"]`) as NodeListOf<HTMLInputElement>
  const allSelected = Array.from(boxes).every(b => b.checked)
  boxes.forEach(b => { b.checked = !allSelected })
  updateExportToggleLabel(group)
  updateExportSelectAllLabel()
}

function updateExportToggleLabel (group: string) {
  const btn = document.querySelector(`#exportConfigItems .sectionToggle[data-group="${group}"]`) as HTMLButtonElement
  if (!btn) return
  const boxes = document.querySelectorAll(
    `#exportConfigItems input[data-group="${group}"]`) as NodeListOf<HTMLInputElement>
  const allSelected = Array.from(boxes).every(b => b.checked)
  btn.textContent = allSelected ? 'Deselect All' : 'Select All'
  updateExportSelectAllLabel()
}

function updateExportSelectAllLabel () {
  const btn = document.getElementById('exportConfigSelectAll') as HTMLButtonElement | null
  if (!btn) return
  const boxes = document.querySelectorAll('#exportConfigItems input[type="checkbox"]') as NodeListOf<HTMLInputElement>
  const allSelected = Array.from(boxes).every(b => b.checked)
  btn.textContent = allSelected ? 'Deselect Entire Config' : 'Select Entire Config'
}

function closeExportConfigModal () {
  document.getElementById('exportConfigModal')!.classList.add('hidden')
}

function exportConfigFromModal () {
  const obj: Partial<GeoBypassSettings> = {}
  const container = document.getElementById('exportConfigItems')!
  const proxyIdxs = Array.from(container.querySelectorAll('input[data-group="proxy"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => Number((c as HTMLInputElement).value))
  if (proxyIdxs.length) obj.proxyList = proxyIdxs.map(i => config.proxyList[i])
  const exportedProxyIds = new Set(obj.proxyList?.map(p => p.id) || [])
  const ruleIdxs = Array.from(container.querySelectorAll('input[data-group="rule"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => Number((c as HTMLInputElement).value))
  if (ruleIdxs.length) obj.rules = ruleIdxs.map(i => {
    const r = config.rules[i]
    return stripRule(r, exportedProxyIds.has(r.proxyId))
  })
  const ovDomains = Array.from(container.querySelectorAll('input[data-group="override"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => (c as HTMLInputElement).value)
  if (ovDomains.length) {
    obj.perWebsiteOverride = {} as GeoBypassSettings['perWebsiteOverride']
    ovDomains.forEach(d => {
      obj.perWebsiteOverride![d] = config.perWebsiteOverride[d]
    })
  }
  const kaIds = Array.from(container.querySelectorAll('input[data-group="keepalive"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => (c as HTMLInputElement).value)
  if (kaIds.length) {
    obj.keepAliveRules = {} as GeoBypassSettings['keepAliveRules']
    kaIds.forEach(id => {
      if (config.keepAliveRules?.[id]) obj.keepAliveRules![id] = config.keepAliveRules[id]
    })
  }
  download('config.json', JSON.stringify(obj, null, 2))
  closeExportConfigModal()
}

function handleImportConfig (files: FileList | null) {
  if (!files || !files[0]) return
  files[0].text().then(async t => {
    try {
      const obj = JSON.parse(t)
      await importConfigObject(obj)
    } catch (e) { console.error(e) }
  })
}

async function runProxyTest (proxy: ProxyListItem) {
  const result = document.getElementById('diagResult') as HTMLElement
  result.textContent = 'Testing...'
  const url = (document.getElementById('diagTestUrl') as HTMLInputElement).value || config.testProxyUrl
  await testProxyConfigQueued(proxy, url, r => {
    if (r.success) {
      result.textContent = `Success for ${r.proxy}`
    } else {
      result.textContent = `Failed for ${r.proxy}: ${r.error}`
    }
  })
}

function getCustomProxyInput (): ProxyListItem | null {
  const type = (document.getElementById('diagType') as HTMLSelectElement).value as ProxyType
  const host = (document.getElementById('diagHost') as HTMLInputElement).value.trim()
  const portStr = (document.getElementById('diagPort') as HTMLInputElement).value
  const username = (document.getElementById('diagUser') as HTMLInputElement).value.trim()
  const password = (document.getElementById('diagPass') as HTMLInputElement).value.trim()
  const port = Number(portStr)
  if (!host || !port) return null
  const proxy: ProxyListItem = {
    id: crypto.randomUUID(),
    type,
    host,
    port,
    proxyDNS: true,
  }
  if (username) proxy.username = username
  if (password) proxy.password = password
  return proxy
}

function renderDiagnostics () {
  const select = document.getElementById('diagSelectProxy') as HTMLSelectElement
  const testUrl = document.getElementById('diagTestUrl') as HTMLInputElement
  select.innerHTML = ''
  config.proxyList.forEach((p, idx) => {
    const opt = createOption(String(idx), p.label || p.host)
    select.appendChild(opt)
  })
  testUrl.value = config.testProxyUrl
}

async function renderNetwork () {
  const container = document.getElementById('networkTree') as HTMLElement
  if (!container) return
  container.innerHTML = ''
  const stats = await browser.runtime.sendMessage({ type: 'getNetworkStats' }).catch(() => null) as NetworkStats | null
  if (!stats) return

  function buildList (nodes: Record<string, NetworkStatsNode>): HTMLUListElement {
    const ul = document.createElement('ul')
    for (const [name, node] of Object.entries(nodes)) {
      if (node.sent === 0 && node.received === 0) continue
      const li = document.createElement('li')
      const hasChildren = node.children && Object.keys(node.children).length > 0
      if (hasChildren) {
        const details = document.createElement('details')
        details.open = true
        const summary = document.createElement('summary')
        summary.textContent = `${name} - sent: ${formatBytes(node.sent)}, received: ${formatBytes(node.received)}`
        details.appendChild(summary)
        details.appendChild(buildList(node.children!))
        li.appendChild(details)
      } else {
        li.textContent = `${name} - sent: ${formatBytes(node.sent)}, received: ${formatBytes(node.received)}`
      }
      ul.appendChild(li)
    }
    return ul
  }

  container.appendChild(buildList(stats.domains))
}

function download (filename: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function clearTabProxies () {
  saveTabProxyMap({})
}

function renderAbout () {
  const { name, version } = browser.runtime.getManifest()
  const nameEl = document.getElementById('aboutName')!
  const versionEl = document.getElementById('aboutVersion')!
  nameEl.textContent = name
  versionEl.textContent = version
}

function renderAll () {
  renderGeneral()
  renderProxyList()
  updatePassHeaderButton()
  renderRules()
  renderKeepAlive()
  renderOverrides()
  renderDiagnostics()
  renderNetwork()
  renderAbout()
}

type TourStep = {
  text: string;
  selector: string | string[];
  tab?: string;
  allowNext?: boolean;
}

function startTour () {
  const steps: TourStep[] = [
    {
      text: 'Use the tabs at the top to navigate the dashboard. Click "Proxy List" to continue.',
      selector: '#tabs button[data-tab="proxy"]',
      tab: 'proxy',
    },
    { text: 'Add your proxies using this button.', selector: '#addProxy', tab: 'proxy' },
    { text: 'Enter a label for your proxy here.', selector: '#proxyLabel', allowNext: true },
    { text: 'Choose the proxy type.', selector: '#proxyType', allowNext: true },
    { text: 'Specify the proxy host name.', selector: '#proxyHost', allowNext: true },
    { text: 'Provide the port number.', selector: '#proxyPort', allowNext: true },
    { text: 'If needed, set a username.', selector: '#proxyUser', allowNext: true },
    { text: 'And its password.', selector: '#proxyPass', allowNext: true },
    { text: 'Enable this option to get notified when the proxy is down.', selector: '#proxyNotify', allowNext: true },
    { text: 'Save the proxy or cancel using these buttons.', selector: ['#saveProxy', '#cancelProxy'] },
    {
      text: 'Create rules to proxy only geo-blocked requests. Click the "Rules" tab.',
      selector: '#tabs button[data-tab="rules"]',
      tab: 'rules',
    },
    {
      text: 'Backup or load configurations via Import/Export.',
      selector: '#tabs button[data-tab="impexp"]',
      tab: 'impexp',
    },
  ]

  const ADD_PROXY_IDX = 1
  const SAVE_STEP_IDX = 9

  const overlay = document.getElementById('tourOverlay') as HTMLElement | null
  const bubble = document.getElementById('tourBubble') as HTMLElement | null
  const text = document.getElementById('tourText') as HTMLElement | null
  const nextBtn = document.getElementById('tourNext') as HTMLButtonElement | null
  const prevBtn = document.getElementById('tourPrev') as HTMLButtonElement | null
  const closeBtn = document.getElementById('tourClose') as HTMLButtonElement | null
  const saveBtn = document.getElementById('saveProxy') as HTMLButtonElement | null
  const cancelBtn = document.getElementById('cancelProxy') as HTMLButtonElement | null
  if (!overlay || !bubble || !text || !nextBtn || !prevBtn || !closeBtn) return

  const saveOrig = saveBtn?.disabled ?? false
  const cancelOrig = cancelBtn?.disabled ?? false

  if (saveBtn != null) {
    saveBtn.disabled = true
  }
  if (cancelBtn != null) {
    cancelBtn.disabled = true
  }

  const completed = steps.map(() => false)
  const stepSection: string[] = []
  let sec = steps[0].tab!
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].tab) sec = steps[i].tab!
    stepSection[i] = sec
  }
  let idx = 0
  let targets: HTMLElement[] = []
  let modalObserver: MutationObserver | null = null
  let modalClosed = false
  const sectionHistory: number[] = [0]
  const innerHistory: Record<number, number[]> = { 0: [] }
  let currentSection = 0
  let currentTab = steps[0].tab!

  function cleanup () {
    for (const t of targets) {
      t.classList.remove('tour-highlight')
      t.removeEventListener('click', onTargetClick, true)
    }
    targets = []
    if (modalObserver) {
      modalObserver.disconnect()
      modalObserver = null
    }
  }

  function advance () {
    const step = steps[idx]
    if (step.tab && step.tab !== currentTab) {
      sectionHistory.push(idx)
      currentSection = idx
      innerHistory[currentSection] = []
      currentTab = step.tab
    } else {
      if (!innerHistory[currentSection]) innerHistory[currentSection] = []
      innerHistory[currentSection].push(idx)
      if (idx === SAVE_STEP_IDX && modalClosed) {
        innerHistory[currentSection] = innerHistory[currentSection].slice(0, ADD_PROXY_IDX)
      }
    }
    completed[idx] = true
    if (idx < steps.length - 1) {
      idx++
      show()
    } else {
      end()
    }
  }

  function onTargetClick () {
    const step = steps[idx]
    if (step.tab) switchTab(step.tab)
    const selectors = Array.isArray(step.selector) ? step.selector : [step.selector]
    if (selectors.includes('#addProxy')) {
      modalClosed = false
      completed[SAVE_STEP_IDX] = false
    }
    if (selectors.includes('#saveProxy') || selectors.includes('#cancelProxy')) {
      const modal = document.getElementById('proxyModal') as HTMLElement | null
      if (!modal) return
      if (modalObserver) modalObserver.disconnect()
      modalObserver = new MutationObserver(() => {
        if (modal.classList.contains('hidden')) {
          modalObserver?.disconnect()
          modalObserver = null
          modalClosed = true
          advance()
        }
      })
      modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] })
    } else {
      advance()
    }
  }

  function show () {
    cleanup()
    const step = steps[idx]
    text!.textContent = step.text
    prevBtn!.style.display = idx > 0 ? '' : 'none'
    nextBtn!.textContent = idx === steps.length - 1 ? 'Done' : 'Next'
    const forceDisableNext = idx === SAVE_STEP_IDX
    nextBtn!.disabled = forceDisableNext || !(completed[idx] || step.allowNext)
    const selectors = Array.isArray(step.selector) ? step.selector : [step.selector]
    targets = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel))) as HTMLElement[]
    const enableSave = selectors.includes('#saveProxy') || selectors.includes('#cancelProxy')
    const modalOpen = !document.getElementById('proxyModal')!.classList.contains('hidden')
    if (modalOpen) {
      if (saveBtn) saveBtn.disabled = !enableSave
      if (cancelBtn) cancelBtn.disabled = !enableSave
    }
    const inModal = targets.some(t => t.closest('#proxyModal'))
    overlay!.classList.toggle('no-dim', inModal)
    if (targets.length) {
      targets.forEach(t => {
        t.classList.add('tour-highlight')
        t.addEventListener('click', onTargetClick, true)
      })
      targets[0].scrollIntoView({ block: 'center' })
      requestAnimationFrame(() => {
        const rect = targets[0].getBoundingClientRect()
        const bubbleRect = bubble!.getBoundingClientRect()
        let top = rect.bottom + 8
        if (top + bubbleRect.height > window.innerHeight) {
          top = rect.top - bubbleRect.height - 8
        }
        if (top < 8) top = 8
        let left = rect.left
        if (left + bubbleRect.width > window.innerWidth) {
          left = window.innerWidth - bubbleRect.width - 8
        }
        if (left < 8) left = 8
        bubble!.style.top = `${top}px`
        bubble!.style.left = `${left}px`
      })
    }
  }

  function end () {
    cleanup()
    overlay!.classList.add('hidden')
    overlay!.classList.remove('no-dim')
    overlay!.style.pointerEvents = 'none'
    bubble!.classList.add('hidden')
    nextBtn!.onclick = null
    prevBtn!.onclick = null
    closeBtn!.onclick = null
    if (saveBtn) saveBtn.disabled = saveOrig
    if (cancelBtn) cancelBtn.disabled = cancelOrig
  }

  nextBtn.onclick = () => {
    const activeBtn = document.querySelector('#tabs button.active') as HTMLElement | null
    const activeTab = activeBtn?.getAttribute('data-tab')
    if (activeTab && activeTab !== stepSection[idx]) {
      const target = steps.findIndex((s, i) => i > idx && s.tab === activeTab)
      if (target > idx) {
        // mark current step complete since we're jumping away
        completed[idx] = true
        const modal = document.getElementById('proxyModal') as HTMLElement | null
        if (modal && !modal.classList.contains('hidden')) {
          closeProxyModal()
          modalClosed = true
          innerHistory[currentSection] = innerHistory[currentSection].slice(0, ADD_PROXY_IDX)
        } else {
          innerHistory[currentSection] = []
        }
        sectionHistory.push(target)
        currentSection = target
        currentTab = activeTab
        completed[target] = true
        idx = Math.min(target + 1, steps.length - 1)
        show()
        return
      }
    }
    if (idx === ADD_PROXY_IDX && completed[idx]) {
      const modal = document.getElementById('proxyModal') as HTMLElement | null
      if (modal && modal.classList.contains('hidden')) openProxyModal()
    }
    advance()
  }

  prevBtn.onclick = () => {
    const inner = innerHistory[currentSection]
    if (inner && inner.length > 0) {
      const prevIdx = inner.pop()!
      if (prevIdx === ADD_PROXY_IDX && idx > ADD_PROXY_IDX) {
        const modal = document.getElementById('proxyModal') as HTMLElement | null
        if (modal && !modal.classList.contains('hidden')) closeProxyModal()
      }
      idx = prevIdx
      show()
    } else if (sectionHistory.length > 1) {
      sectionHistory.pop()
      currentSection = sectionHistory[sectionHistory.length - 1]
      const prevInner = innerHistory[currentSection]
      let prevIdx = prevInner?.pop()
      if (prevIdx == null) prevIdx = currentSection
      if (prevIdx === ADD_PROXY_IDX && idx > ADD_PROXY_IDX) {
        const modal = document.getElementById('proxyModal') as HTMLElement | null
        if (modal && !modal.classList.contains('hidden')) closeProxyModal()
      }
      currentTab = steps[currentSection].tab!
      idx = prevIdx
      show()
    }
  }

  closeBtn.onclick = end

  overlay!.classList.remove('hidden')
  overlay!.style.pointerEvents = 'auto'
  bubble!.classList.remove('hidden')
  idx = 0
  modalClosed = false
  show()
}

document.addEventListener('DOMContentLoaded', async () => {
  config = await getConfig()
  renderAll()

  const tourSeen = await getTourShown()
  document.getElementById('startTourBtn')?.addEventListener('click', startTour)
  if (!tourSeen) {
    startTour()
    setTourShown(true)
  }

  if (!supportsProxyOnRequest) {
    document.getElementById('clearTabProxies')?.remove()
    document.querySelector('button[data-tab="override"]')?.remove()
    document.getElementById('override')?.remove()
    document.getElementById('networkHint')?.classList.remove('hidden')
  }

  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')!))
  })
  document.getElementById('navToggle')?.addEventListener('click', () => {
    const tabs = document.getElementById('tabs')
    const navToggle = document.getElementById('navToggle') as HTMLButtonElement | null
    if (!tabs) return
    const open = tabs.classList.toggle('open')
    if (navToggle) navToggle.classList.toggle('open', open)
  })
  switchTab('general')

  document.getElementById('addProxy')!.addEventListener('click', () => openProxyModal())
  document.getElementById('saveProxy')!.addEventListener('click', saveProxyFromModal)
  document.getElementById('cancelProxy')!.addEventListener('click', closeProxyModal)
  document.getElementById('exportProxiesSelected')!.addEventListener('click', exportSelectedProxies)
  document.getElementById('deleteProxiesSelected')!.addEventListener('click', deleteSelectedProxies)
  document.getElementById('exportProxiesAll')!.addEventListener('click', exportAllProxies)
  document.getElementById('importProxiesBtn')!.addEventListener('click', () =>
    document.getElementById('importProxies')!.click())
  document.getElementById('importProxies')!.addEventListener('change', ev =>
    handleImportProxies((ev.target as HTMLInputElement).files))
  document.getElementById('togglePassColumn')!.addEventListener('click', () => {
    revealAllPasswords = !revealAllPasswords
    revealedPasswords.clear()
    renderProxyList()
    updatePassHeaderButton()
  })
  document.getElementById('addRule')!.addEventListener('click', addRule)
  document.getElementById('addOverride')?.addEventListener('click', openOverrideModal)
  document.getElementById('exportOverridesSelected')?.addEventListener('click', exportSelectedOverrides)
  document.getElementById('deleteOverridesSelected')?.addEventListener('click', deleteSelectedOverrides)
  document.getElementById('exportOverridesAll')?.addEventListener('click', exportAllOverrides)
  document.getElementById('importOverridesBtn')?.addEventListener('click', () =>
    document.getElementById('importOverrides')?.click())
  document.getElementById('importOverrides')?.addEventListener('change', ev =>
    handleImportOverrides((ev.target as HTMLInputElement).files))
  document.getElementById('addKeepAliveRule')!.addEventListener('click', () => openKeepAliveModal())
  document.getElementById('exportKeepAliveSelected')!.addEventListener('click', exportSelectedKeepAlive)
  document.getElementById('deleteKeepAliveSelected')!.addEventListener('click', deleteSelectedKeepAlive)
  document.getElementById('exportKeepAliveAll')!.addEventListener('click', exportAllKeepAlive)
  document.getElementById('importKeepAliveBtn')!.addEventListener('click', () =>
    document.getElementById('importKeepAlive')!.click())
  document.getElementById('importKeepAlive')!.addEventListener('change', ev =>
    handleImportKeepAlive((ev.target as HTMLInputElement).files))
  document.getElementById('exportRulesSelected')!.addEventListener('click', exportSelectedRules)
  document.getElementById('deleteRulesSelected')!.addEventListener('click', deleteSelectedRules)
  document.getElementById('exportRulesAll')!.addEventListener('click', exportAllRules)
  document.getElementById('importRulesBtn')!.addEventListener('click', () =>
    document.getElementById('importRules')!.click())
  document.getElementById('importRules')!.addEventListener('change', ev =>
    handleImportRules((ev.target as HTMLInputElement).files))
  document.getElementById('saveRule')!.addEventListener('click', saveRuleFromModal)
  document.getElementById('cancelRule')!.addEventListener('click', closeRuleModal)
  document.getElementById('editRuleMatch')!.addEventListener('click',
    () => openListModal(
      'ruleMatch',
      'Match Patterns',
      validatePattern,
      {
        href: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns',
        title: 'Uses WebExtension match patterns',
      },
    ))
  document.getElementById('editRuleBypassUrls')!.addEventListener('click',
    () => openListModal(
      'ruleBypassUrls',
      'Bypass URL Patterns',
      validatePattern,
      {
        href: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns',
        title: 'Uses WebExtension match patterns',
      },
    ))
  document.getElementById('editRuleForceUrls')!.addEventListener('click',
    () => openListModal(
      'ruleForceUrls',
      'Force Proxy URL Patterns',
      validatePattern,
      {
        href: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns',
        title: 'Uses WebExtension match patterns',
      },
    ))
  document.getElementById('editRuleBypassTypes')!.addEventListener('click', () => openTypeModal('ruleBypassTypes'))
  document.getElementById('addListItem')!.addEventListener('click', () => {
    const container = document.getElementById('listModalItems')!
    addListItem(container)
  })
  document.getElementById('saveList')!.addEventListener('click', saveListModal)
  document.getElementById('cancelList')!.addEventListener('click', closeListModal)
  document.getElementById('saveTypes')!.addEventListener('click', saveTypeModal)
  document.getElementById('cancelTypes')!.addEventListener('click', closeTypeModal)
  document.getElementById('saveOverride')?.addEventListener('click', saveOverrideFromModal)
  document.getElementById('cancelOverride')?.addEventListener('click', closeOverrideModal)
  document.getElementById('saveKeepAlive')!.addEventListener('click', saveKeepAliveFromModal)
  document.getElementById('cancelKeepAlive')!.addEventListener('click', closeKeepAliveModal)
  document.getElementById('editKeepAlivePatterns')!.addEventListener('click', () =>
    openListModal(
      'keepAlivePatterns',
      'List of URLs',
      validateHostnamePattern,
      { title: 'Hostname pattern, e.g. example.com or *.example.com' },
    ))

  document.getElementById('diagTestSelected')!.addEventListener('click', () => {
    const sel = document.getElementById('diagSelectProxy') as HTMLSelectElement
    const idx = Number(sel.value)
    const proxy = config.proxyList[idx]
    if (proxy) runProxyTest(proxy)
  })
  document.getElementById('diagEditSelected')!.addEventListener('click', () => {
    const sel = document.getElementById('diagSelectProxy') as HTMLSelectElement
    const idx = Number(sel.value)
    if (!isNaN(idx)) openProxyModal(idx)
  })
  document.getElementById('diagTestCustom')!.addEventListener('click', () => {
    const proxy = getCustomProxyInput()
    if (proxy) runProxyTest(proxy)
  })
  document.getElementById('diagAddProxy')!.addEventListener('click', () => {
    const proxy = getCustomProxyInput()
    if (!proxy) return
    openProxyModal()
    ;(document.getElementById('proxyType') as HTMLSelectElement).value = proxy.type
    ;(document.getElementById('proxyHost') as HTMLInputElement).value = proxy.host
    ;(document.getElementById('proxyPort') as HTMLInputElement).value = String(proxy.port)
    ;(document.getElementById('proxyUser') as HTMLInputElement).value = proxy.username || ''
    ;(document.getElementById('proxyPass') as HTMLInputElement).value = proxy.password || ''
  })
  document.getElementById('openExportConfig')!.addEventListener('click', openExportConfigModal)
  document.getElementById('exportConfigConfirm')!.addEventListener('click', exportConfigFromModal)
  document.getElementById('exportConfigCancel')!.addEventListener('click', closeExportConfigModal)
  document.getElementById('exportConfigSelectAll')!.addEventListener('click', exportConfigSelectAll)
  document.getElementById('importConfigBtn')!.addEventListener('click', () =>
    document.getElementById('importConfig')!.click())
  document.getElementById('importConfig')!.addEventListener('change', ev =>
    handleImportConfig((ev.target as HTMLInputElement).files))
  document.getElementById('importUrlBtn')!.addEventListener('click', () => {
    const url = (document.getElementById('importUrlInput') as HTMLInputElement).value.trim()
    if (!url) return
    if (/\.json$/.test(url)) {
      importConfigFromUrl(url)
      return
    }
    const repoMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.*))?\/?$/)
    if (repoMatch) {
      const [, owner, repo, prefix] = repoMatch
      openRemoteImportModal(owner, repo, prefix)
    } else {
      alert('Please enter a GitHub repository URL or direct JSON link.')
    }
  })
  document.getElementById('openCommunityImport')!.addEventListener('click',
    () => openRemoteImportModal('MeGaNeKoS', 'GeoBypass-Rules'))
  document.getElementById('remoteImportConfirm')!.addEventListener('click', confirmRemoteImport)
  document.getElementById('remoteImportCancel')!.addEventListener('click', closeRemoteImportModal)
  document.getElementById('remoteImportSelectAll')!.addEventListener('click', remoteSelectAll)
  const clearTabEl = document.getElementById('clearTabProxies')
  clearTabEl?.addEventListener('click', clearTabProxies)
  document.getElementById('refreshNetwork')!.addEventListener('click', renderNetwork)
  document.getElementById('clearNetwork')!.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'clearNetworkStats' }).catch(() => {})
    renderNetwork()
  })
  const toggleAuto = document.getElementById('toggleNetworkAuto') as HTMLButtonElement | null

  function updateAutoLabel () {
    if (!toggleAuto) return
    toggleAuto.textContent = networkAutoInterval ? 'Auto Refresh: On' : 'Auto Refresh: Off'
  }

  toggleAuto?.addEventListener('click', () => {
    if (networkAutoInterval) {
      clearInterval(networkAutoInterval)
      networkAutoInterval = null
    } else {
      networkAutoInterval = setInterval(renderNetwork, 5000)
    }
    updateAutoLabel()
  })

  updateAutoLabel()
})
