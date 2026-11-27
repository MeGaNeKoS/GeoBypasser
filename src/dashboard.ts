import {
  compileRules,
  getConfig,
  saveConfig,
  saveTabProxyMap,
  updateConfig,
} from '@utils/storage'
import { WEB_REQUEST_RESOURCE_TYPES, WebRequestResourceType } from '@constant/requestTypes'
import { KeepAliveProxyRule, ProxyListItem, ProxyRule, RuntimeProxyRule } from '@customTypes/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import { testProxyConfigQueued } from '@utils/proxy'
import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import { ProxyType } from '@customTypes/generic'
import type { GeoBypassSettings } from '@customTypes/settings'
import { formatBytes, NetworkStats, NetworkStatsNode } from '@utils/network'
import { refuseConfigFile, refuseKeepAliveRules, refuseOverrides, refuseProxyItems, refuseRules, withImportedRules } from '@utils/importFiles'
import { proxyFormValues, ruleFormValues } from '@utils/editFields'
import { exportedRules } from '@utils/ruleExport'
import { exportProxyList, keepStoredCredentials } from '@utils/proxyCredentials'
import { isValidProxyItem } from '@utils/validity'
import { markInvalid, markRuleFieldsInvalid } from '@utils/fieldMarks'
import {
  isValidDomain,
  isValidPattern,
  isValidProxyId,
  isValidStaticExtensions,
  isValidTestUrl,
  validateDomain,
  validateHostnamePattern,
} from '@utils/validity'
import {
  canSaveDefaultProxy,
  canSaveKeepAliveRule,
  canSaveOverride,
  canSaveProxy,
  canSaveRuleForm,
  canSaveTestUrl,
  proxyFieldsAtFault,
} from '@utils/saveDecisions'
import { keepAliveRows, overrideRows, proxyOptions, proxyRows, ruleRows } from '@utils/pageView'
import { alertUnsavedChanges } from '@utils/saveFailure'

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
  return val.split(/\s*,\s*/).filter(Boolean).every(isValidPattern)
}

function validateResourceTypes (val: string) {
  return val.split(/\s*,\s*/).filter(Boolean).every(
    v => WEB_REQUEST_RESOURCE_TYPES.includes(v as WebRequestResourceType))
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
  proxyOptions(config.proxyList).forEach(p => select.appendChild(createOption(p.id, p.label || p.host)))
  select.value = config.defaultProxy || ''

  const fallback = document.getElementById('fallbackDirect') as HTMLInputElement
  fallback.checked = !!config.fallbackDirect

  const testUrl = document.getElementById('testProxyUrl') as HTMLInputElement
  testUrl.value = config.testProxyUrl
  markInvalid(testUrl, false)

  // const mode = document.getElementById('storageMode') as HTMLSelectElement
  // browser.storage.local.get('storageMode').then(res => {
  //   mode.value = res.storageMode === 'cloud' ? 'cloud' : 'local'
  // })

  select.onchange = () => {
    if (canSaveDefaultProxy(select.value, config.proxyList)) updateConfig({ defaultProxy: select.value || undefined })
  }
  fallback.onchange = () => updateConfig({ fallbackDirect: fallback.checked })
  testUrl.onchange = () => {
    const valid = canSaveTestUrl(testUrl.value)
    markInvalid(testUrl, !valid)
    if (valid) updateConfig({ testProxyUrl: testUrl.value })
  }
  // mode.onchange = () => browser.storage.local.set({ storageMode: mode.value })
}

function renderProxyList () {
  const tbody = document.querySelector('#proxyTable tbody') as HTMLElement
  tbody.innerHTML = ''
  proxyRows(config.proxyList, idx => revealAllPasswords || revealedPasswords.has(idx)).forEach(row => {
    const { index: idx, entry: p, invalid } = row
    const tr = document.createElement('tr')
    if (invalid) tr.classList.add('invalid-proxy')

    const visible = revealAllPasswords || revealedPasswords.has(idx)

    const labelCell = document.createElement('td')
    labelCell.textContent = row.label
    tr.appendChild(labelCell)

    const typeCell = document.createElement('td')
    typeCell.textContent = row.type
    tr.appendChild(typeCell)

    const hostCell = document.createElement('td')
    hostCell.textContent = row.host
    tr.appendChild(hostCell)

    const portCell = document.createElement('td')
    portCell.textContent = row.port
    tr.appendChild(portCell)

    const userCell = document.createElement('td')
    userCell.textContent = row.username
    tr.appendChild(userCell)

    const passCell = document.createElement('td')
    passCell.className = 'password'
    passCell.textContent = row.password
    tr.appendChild(passCell)

    const notifyCell = document.createElement('td')
    const notifyChk = document.createElement('input')
    notifyChk.type = 'checkbox'
    notifyChk.dataset.notify = ''
    notifyChk.checked = row.notifyIfDown
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

    if (row.hasPassword) {
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
  markInvalid(host, false)
  markInvalid(port, false)
  const user = document.getElementById('proxyUser') as HTMLInputElement
  const pass = document.getElementById('proxyPass') as HTMLInputElement
  const notify = document.getElementById('proxyNotify') as HTMLInputElement

  if (editingProxyIndex !== null) {
    const values = proxyFormValues(config.proxyList[editingProxyIndex])
    title.textContent = 'Edit Proxy'
    label.value = values.label
    type.value = values.type
    host.value = values.host
    port.value = values.port
    user.value = values.username
    pass.value = values.password
    notify.checked = values.notifyIfDown
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

function proxyIdForSave (): string {
  const editedId = editingProxyIndex !== null ? config.proxyList[editingProxyIndex]?.id : undefined
  return isValidProxyId(editedId) ? editedId : crypto.randomUUID()
}

function saveProxyFromModal () {
  const label = (document.getElementById('proxyLabel') as HTMLInputElement).value
  const type = (document.getElementById('proxyType') as HTMLSelectElement).value as ProxyType
  const host = (document.getElementById('proxyHost') as HTMLInputElement).value
  const port = Number((document.getElementById('proxyPort') as HTMLInputElement).value)
  const username = (document.getElementById('proxyUser') as HTMLInputElement).value
  const password = (document.getElementById('proxyPass') as HTMLInputElement).value
  const notify = (document.getElementById('proxyNotify') as HTMLInputElement).checked

  const base: ProxyListItem = {
    id: proxyIdForSave(),
    type,
    host,
    port,
    proxyDNS: true,
  }
  if (label) base.label = label
  if (username) base.username = username
  if (password) base.password = password
  if (notify) base.notifyIfDown = true

  if (!canSaveProxy(base)) {
    const faults = proxyFieldsAtFault(base)
    markInvalid(document.getElementById('proxyType')!, faults.type)
    markInvalid(document.getElementById('proxyHost')!, faults.host)
    markInvalid(document.getElementById('proxyPort')!, faults.port)
    return
  }

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
  ruleRows(config.rules, config.proxyList).forEach(row => {
    const { index: idx, rule: r, invalid } = row
    const tr = document.createElement('tr')

    const activeCell = document.createElement('td')
    const activeChk = document.createElement('input')
    activeChk.type = 'checkbox'
    activeChk.dataset.active = ''
    activeChk.checked = row.active
    activeCell.appendChild(activeChk)
    tr.appendChild(activeCell)

    const nameCell = document.createElement('td')
    nameCell.textContent = row.name
    tr.appendChild(nameCell)

    const matchCell = document.createElement('td')
    matchCell.textContent = row.match
    tr.appendChild(matchCell)

    const proxyCell = document.createElement('td')
    proxyCell.textContent = row.proxyLabel
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
    if (row.missingProxy) tr.classList.add('missing-proxy')
    if (invalid) tr.classList.add('invalid-rule')
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
    expBtn.onclick = () => exportRules([config.rules[idx]])
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
  proxyOptions(config.proxyList).forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))
  const kaExists = editingKeepAliveId ? proxyOptions(config.proxyList).some(p => p.id === editingKeepAliveId) : false
  if (editingKeepAliveId && !kaExists) {
    proxy.appendChild(createOption(editingKeepAliveId, `Missing Proxy (${editingKeepAliveId})`))
  }

  if (editingRuleIndex !== null) {
    const values = ruleFormValues(config.rules[editingRuleIndex])
    title.textContent = 'Edit Rule'
    name.value = values.name
    match.value = values.match
    proxy.value = values.proxyId
    bypassUrls.value = values.bypassUrlPatterns
    bypassTypes.value = values.bypassResourceTypes
    staticExt.value = values.staticExtensions
    forceUrls.value = values.forceProxyUrlPatterns
    fbDirect.checked = values.fallbackDirect
    active.checked = values.active
  } else {
    title.textContent = 'Add Rule'
    name.value = ''
    match.value = ''
    proxy.value = proxyOptions(config.proxyList)[0]?.id || ''
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
  setValidation(staticExt, isValidStaticExtensions)
  setValidation(forceUrls, validatePatternList)
  markInvalid(name, false)
  markInvalid(proxy, false)
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

  if (!canSaveRuleForm(rule)) {
    markRuleFieldsInvalid(rule)
    return
  }

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
  const tbody = document.querySelector('#overrideTable tbody') as HTMLElement | null
  if (!tbody) return
  tbody.innerHTML = ''
  for (const { domain, proxyLabel } of overrideRows(config.perWebsiteOverride, config.proxyList)) {
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
  proxyOptions(config.proxyList).forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))
  proxy.value = proxyOptions(config.proxyList)[0]?.id || ''
  markInvalid(proxy, false)
  setValidation(domain, validateDomain)
  modal.classList.remove('hidden')
}

function closeOverrideModal () {
  document.getElementById('overrideModal')!.classList.add('hidden')
}

function saveOverrideFromModal () {
  const domainField = document.getElementById('overrideDomain') as HTMLInputElement
  const proxyField = document.getElementById('overrideProxy') as HTMLSelectElement
  const domain = domainField.value.trim()
  const proxyId = proxyField.value
  if (!canSaveOverride(domain, proxyId)) {
    markInvalid(domainField, !isValidDomain(domain))
    markInvalid(proxyField, !proxyId)
    return
  }
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
  proxyOptions(config.proxyList).forEach(p => proxy.appendChild(createOption(p.id, p.label || p.host)))
  const kaExists = editingKeepAliveId ? proxyOptions(config.proxyList).some(p => p.id === editingKeepAliveId) : false
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
    proxy.value = proxyOptions(config.proxyList)[0]?.id || ''
    patterns.value = ''
    testUrl.value = ''
    active.checked = true
  }
  markInvalid(proxy, false)
  markInvalid(testUrl, false)
  updateListDisplay(patterns)
  setValidation(patterns, validateHostnamePattern)
  modal.classList.remove('hidden')
}

function closeKeepAliveModal () {
  document.getElementById('keepAliveModal')!.classList.add('hidden')
}

function saveKeepAliveFromModal () {
  const proxyField = document.getElementById('keepAliveProxy') as HTMLSelectElement
  const patternsField = document.getElementById('keepAlivePatterns') as HTMLInputElement
  const testUrlField = document.getElementById('keepAliveTestUrl') as HTMLInputElement
  const proxyId = proxyField.value
  const patterns = patternsField.value.split(/\s*,\s*/).filter(Boolean)
  const testUrl = testUrlField.value.trim()
  const active = (document.getElementById('keepAliveActive') as HTMLInputElement).checked
  const rule: { active: boolean; tabUrls: string[]; testProxyUrl?: string } = { active, tabUrls: patterns }
  if (testUrl) rule.testProxyUrl = testUrl
  if (!proxyId || !canSaveKeepAliveRule(rule)) {
    markInvalid(proxyField, !proxyId)
    markInvalid(patternsField, patterns.length === 0 || !patterns.every(validateHostnamePattern))
    markInvalid(testUrlField, !!testUrl && !isValidTestUrl(testUrl))
    return
  }
  if (!config.keepAliveRules) config.keepAliveRules = {}
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
  for (const { proxyId, raw: rule, proxyLabel, active, tabUrls, testProxyUrl, missingProxy } of keepAliveRows(config.keepAliveRules, config.proxyList)) {
    const tr = document.createElement('tr')

    const activeCell = document.createElement('td')
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.dataset.active = ''
    chk.checked = active
    activeCell.appendChild(chk)
    tr.appendChild(activeCell)

    const proxyCell = document.createElement('td')
    proxyCell.textContent = proxyLabel
    tr.appendChild(proxyCell)

    const urlsCell = document.createElement('td')
    urlsCell.textContent = tabUrls
    tr.appendChild(urlsCell)

    const testCell = document.createElement('td')
    testCell.textContent = testProxyUrl
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

    if (missingProxy) tr.classList.add('missing-proxy')
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

function getExportableConfig () {
  return {
    proxyList: config.proxyList,
    defaultProxy: config.defaultProxy,
    fallbackDirect: config.fallbackDirect,
    rules: exportedRules(config.rules, () => true),
    keepAliveRules: config.keepAliveRules,
    testProxyUrl: config.testProxyUrl,
    perWebsiteOverride: config.perWebsiteOverride,
  }
}

async function mergeConfigData (cfg: Partial<GeoBypassSettings>) {
  const base = {
    proxyList: config.proxyList,
    defaultProxy: config.defaultProxy,
    fallbackDirect: config.fallbackDirect,
    rules: config.rules,
    keepAliveRules: config.keepAliveRules,
    testProxyUrl: config.testProxyUrl,
    perWebsiteOverride: config.perWebsiteOverride,
  }
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
    const existing = new Map(updated.proxyList.flatMap((p, idx) => isValidProxyItem(p) ? [[proxySignature(p), idx] as const] : []))
    for (const p of keepStoredCredentials(cfg.proxyList as ProxyListItem[], updated.proxyList)) {
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

function alertImportMessages (messages: string[]) {
  if (messages.length > 0) alert(messages.join('\n'))
}

async function importConfigObject (obj: unknown) {
  const verdict = refuseConfigFile(obj)
  alertImportMessages(verdict.messages)
  await mergeConfigData(verdict.accepted)
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

interface FileTreeNode {
  children?: Record<string, FileTreeNode>
  url?: string
}

function buildFileTree (files: { path: string; url: string }[]): FileTreeNode {
  const root: FileTreeNode = { children: {} }
  for (const file of files) {
    const parts = file.path.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      node.children = node.children || {}
      node.children[part] = node.children[part] || {}
      if (i === parts.length - 1) {
        node.children[part].url = file.url
      } else {
        node = node.children[part]
      }
    }
  }
  return root
}

function createFileTreeElement (node: FileTreeNode): HTMLUListElement {
  const ul = document.createElement('ul')
  for (const [name, child] of Object.entries(node.children || {})) {
    const li = document.createElement('li')
    if (child.children) {
      const details = document.createElement('details')
      details.open = true
      const summary = document.createElement('summary')

      const label = document.createElement('label')
      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.dataset.folder = 'true'
      chk.checked = true
      label.appendChild(chk)
      label.append(' ', name)
      summary.appendChild(label)

      details.appendChild(summary)
      const childUl = createFileTreeElement(child)
      details.appendChild(childUl)
      li.appendChild(details)

      chk.addEventListener('change', () => {
        childUl.querySelectorAll('input[type="checkbox"]').forEach(c => {
          (c as HTMLInputElement).checked = chk.checked
        })
        updateRemoteSelectButtons()
      })
    } else if (child.url) {
      const label = document.createElement('label')
      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.value = child.url
      chk.checked = true
      chk.addEventListener('change', updateRemoteSelectButtons)
      label.appendChild(chk)
      label.append(' ', name)
      li.appendChild(label)
    }
    ul.appendChild(li)
  }
  return ul
}

function openRemoteImportModal (owner: string, repo: string, prefix = '') {
  const modal = document.getElementById('remoteImportModal')!
  const container = document.getElementById('remoteFileTree')!
  container.innerHTML = 'Loading...'
  container.classList.add('tree')
  updateRemoteSelectButtons()
  fetchGitHubFileList(owner, repo, prefix).then(files => {
    container.innerHTML = ''
    const tree = buildFileTree(files)
    container.appendChild(createFileTreeElement(tree))
    updateRemoteSelectButtons()
  })
  modal.classList.remove('hidden')
}

function closeRemoteImportModal () {
  document.getElementById('remoteImportModal')?.classList.add('hidden')
}

function remoteSelectAll () {
  const boxes = document.querySelectorAll('#remoteFileTree input[type="checkbox"]') as NodeListOf<HTMLInputElement>
  boxes.forEach(b => { b.checked = true })
  updateRemoteSelectButtons()
}

function remoteUnselectAll () {
  const boxes = document.querySelectorAll('#remoteFileTree input[type="checkbox"]') as NodeListOf<HTMLInputElement>
  boxes.forEach(b => { b.checked = false })
  updateRemoteSelectButtons()
}

function updateRemoteSelectButtons () {
  const btnAll = document.getElementById('remoteImportSelectAll') as HTMLButtonElement | null
  const btnNone = document.getElementById('remoteImportUnselectAll') as HTMLButtonElement | null
  if (!btnAll || !btnNone) return
  const boxes = document.querySelectorAll('#remoteFileTree input[type="checkbox"]') as NodeListOf<HTMLInputElement>
  const total = boxes.length
  const checked = Array.from(boxes).filter(b => b.checked).length
  if (checked === 0) {
    btnAll.classList.remove('hidden')
    btnNone.classList.add('hidden')
  } else if (checked === total) {
    btnAll.classList.add('hidden')
    btnNone.classList.remove('hidden')
  } else {
    btnAll.classList.remove('hidden')
    btnNone.classList.remove('hidden')
  }
}

async function confirmRemoteImport () {
  const urls = Array.from(document.querySelectorAll('#remoteFileTree input[type="checkbox"]:not([data-folder])'))
    .filter(el => (el as HTMLInputElement).checked)
    .map(el => (el as HTMLInputElement).value)
  for (const url of urls) {
    await importConfigFromUrl(url)
  }
  closeRemoteImportModal()
}

function exportRules (rules: unknown[]) {
  const sanitized = exportedRules(rules, () => false)
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
      const verdict = refuseRules(raw?.rules)
      alertImportMessages(verdict.messages)
      config = withImportedRules(config, verdict.accepted)
      saveConfig(config).then(renderAll)

    } catch (e) {
      console.error('Error importing proxy rules:', e)
      alert('Failed to import rules: invalid JSON')
    }
  })
}

function exportProxies (list: ProxyListItem[]) {
  download('proxies.json', JSON.stringify({ proxyList: exportProxyList(list, 'omit') }, null, 2))
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
      const verdict = refuseProxyItems(raw?.proxyList)
      alertImportMessages(verdict.messages)
      const arr = keepStoredCredentials(verdict.accepted, config.proxyList)
      const existing = new Map(config.proxyList.flatMap((p, idx) => isValidProxyItem(p) ? [[proxySignature(p), idx] as const] : []))

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
      const verdict = refuseOverrides(parsed?.perWebsiteOverride)
      alertImportMessages(verdict.messages)
      Object.assign(config.perWebsiteOverride, verdict.accepted)
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
      const verdict = refuseKeepAliveRules(parsed?.keepAliveRules)
      alertImportMessages(verdict.messages)
      if (!config.keepAliveRules) config.keepAliveRules = {}

      Object.assign(config.keepAliveRules, verdict.accepted)
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
  proxyRows(config.proxyList).forEach(({ index: idx, label: text }) => {
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
    label.append(' ', text)
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
  ruleRows(config.rules, config.proxyList).forEach(({ index: idx, name: text }) => {
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
    label.append(' ', text)
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
  for (const { domain } of overrideRows(config.perWebsiteOverride, config.proxyList)) {
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
  for (const { proxyId, proxyLabel: display } of keepAliveRows(config.keepAliveRules, config.proxyList)) {
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
  ;(document.getElementById('exportConfigCredentials') as HTMLInputElement).checked = false

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

type ExportedConfig = Partial<Omit<GeoBypassSettings, 'rules'>> & { rules?: Record<string, unknown>[] }

function exportConfigFromModal () {
  const obj: ExportedConfig = {}
  const container = document.getElementById('exportConfigItems')!
  const proxyIdxs = Array.from(container.querySelectorAll('input[data-group="proxy"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => Number((c as HTMLInputElement).value))
  const includeCredentials = (document.getElementById('exportConfigCredentials') as HTMLInputElement).checked
  if (proxyIdxs.length) {
    obj.proxyList = exportProxyList(proxyIdxs.map(i => config.proxyList[i]), includeCredentials ? 'include' : 'omit')
  }
  const exportedProxyIds = new Set(obj.proxyList?.map(p => p?.id) || [])
  const ruleIdxs = Array.from(container.querySelectorAll('input[data-group="rule"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => Number((c as HTMLInputElement).value))
  if (ruleIdxs.length) {
    obj.rules = exportedRules(ruleIdxs.map(i => config.rules[i]), proxyId => typeof proxyId === 'string' && exportedProxyIds.has(proxyId))
  }
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
  proxyRows(config.proxyList).filter(row => !row.invalid).forEach(({ index: idx, label: text }) => {
    const opt = createOption(String(idx), text)
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


document.addEventListener('DOMContentLoaded', async () => {
alertUnsavedChanges(window, alert)

  config = await getConfig()
  renderAll()

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
      isValidPattern,
      {
        href: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns',
        title: 'Uses WebExtension match patterns',
      },
    ))
  document.getElementById('editRuleBypassUrls')!.addEventListener('click',
    () => openListModal(
      'ruleBypassUrls',
      'Bypass URL Patterns',
      isValidPattern,
      {
        href: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns',
        title: 'Uses WebExtension match patterns',
      },
    ))
  document.getElementById('editRuleForceUrls')!.addEventListener('click',
    () => openListModal(
      'ruleForceUrls',
      'Force Proxy URL Patterns',
      isValidPattern,
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
  document.getElementById('remoteImportUnselectAll')!.addEventListener('click', remoteUnselectAll)
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
