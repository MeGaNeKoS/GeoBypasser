import {
  getConfig,
  saveConfig,
  saveTabProxyMap,
  updateConfig,
} from '@utils/storage'
import { KeepAliveProxyRule, ProxyListItem, ProxyRule } from '@customTypes/proxy'
import { testProxyConfigQueued } from '@utils/proxy'
import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import { ProxyType } from '@customTypes/generic'
import type { GeoBypassSettings } from '@customTypes/settings'
import { formatBytes, NetworkStats, NetworkStatsNode } from '@utils/network'
import { findSettingChanges, refuseConfigFile, refuseKeepAliveRules, refuseOverrides, withAppliedSettings } from '@utils/importFiles'
import { chooseAppliedSettingChanges } from './settingChangeModal'
import {
  KEEP_ALIVE_FORM_FIELDS,
  mergeEditedFields,
} from '@utils/editFields'
import { keepStoredCredentials } from '@utils/proxyCredentials'
import { buildConfigExport } from '@utils/exportFiles'
import { isValidProxyItem } from '@utils/validity'
import { markInvalid } from '@utils/fieldMarks'
import {
  isBareHostname,
  isValidTestUrl,
  validateHostnamePattern,
} from '@utils/validity'
import {
  canSaveDefaultProxy,
  canSaveKeepAliveRule,
  canSaveOverride,
  canSaveTestUrl,
} from '@utils/saveDecisions'
import { keepAliveRows, overrideRows, proxyOptions, proxyRows, ruleRows } from '@utils/pageView'
import { alertUnsavedChanges } from '@utils/saveFailure'
import { mountDashboardFrame } from '@ui/shell/frame'
import { downloadJsonFile } from '@ui/download'
import { openProxyEditor } from '@ui/proxies/proxySheet'

let config: Awaited<ReturnType<typeof getConfig>>
const selectedOverrides = new Set<string>()
const selectedKeepAlive = new Set<string>()
let listTargetInput: HTMLInputElement | null = null
let currentListValidator: (val: string) => boolean = () => true
let editingKeepAliveId: string | null = null
let networkAutoInterval: ReturnType<typeof setInterval> | null = null

// Helper to generate a signature for comparing proxy entries

function proxySignature (p: ProxyListItem) {
  return `${p.type}-${p.host}:${p.port}-${p.username || ''}`
}

function createOption (id: string, label: string) {
  const opt = document.createElement('option')
  opt.value = id
  opt.textContent = label
  return opt
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

  select.onchange = () => {
    if (canSaveDefaultProxy(select.value, config.proxyList)) updateConfig({ defaultProxy: select.value || undefined })
  }
  fallback.onchange = () => updateConfig({ fallbackDirect: fallback.checked })
  testUrl.onchange = () => {
    const valid = canSaveTestUrl(testUrl.value)
    markInvalid(testUrl, !valid)
    if (valid) updateConfig({ testProxyUrl: testUrl.value })
  }
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
  setValidation(domain, isBareHostname)
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
    markInvalid(domainField, !isBareHostname(domain))
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
  const storedKeepAliveRule = editingKeepAliveId ? config.keepAliveRules[editingKeepAliveId] : undefined
  if (editingKeepAliveId && editingKeepAliveId !== proxyId) {
    delete config.keepAliveRules[editingKeepAliveId]
  }
  config.keepAliveRules[proxyId] = mergeEditedFields(storedKeepAliveRule, rule, KEEP_ALIVE_FORM_FIELDS)
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
      const current = config.keepAliveRules?.[proxyId]
      if (current) current.active = chk.checked
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

  const applied = await chooseAppliedSettingChanges(findSettingChanges(base, updated, updated.proxyList))
  Object.assign(updated, withAppliedSettings(base, updated, applied))

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

function exportOverrides (obj: Record<string, string>) {
  downloadJsonFile('overrides.json', JSON.stringify({ perWebsiteOverride: obj }, null, 2))
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
  downloadJsonFile('keepalive.json', JSON.stringify({ keepAliveRules: obj }, null, 2))
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
  ;(document.getElementById('exportConfigLeaveOutCredentials') as HTMLInputElement).checked = false

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
  const container = document.getElementById('exportConfigItems')!
  const proxyIndexes = Array.from(container.querySelectorAll('input[data-group="proxy"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => Number((c as HTMLInputElement).value))
  const ruleIndexes = Array.from(container.querySelectorAll('input[data-group="rule"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => Number((c as HTMLInputElement).value))
  const overrideDomains = Array.from(container.querySelectorAll('input[data-group="override"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => (c as HTMLInputElement).value)
  const keepAliveIds = Array.from(container.querySelectorAll('input[data-group="keepalive"]')).filter(
    (c) => (c as HTMLInputElement).checked).map(c => (c as HTMLInputElement).value)
  const leaveOut = (document.getElementById('exportConfigLeaveOutCredentials') as HTMLInputElement).checked
  const exported = buildConfigExport(
    config,
    { proxyIndexes, ruleIndexes, overrideDomains, keepAliveIds },
    leaveOut ? 'omit' : 'include',
  )
  downloadJsonFile('config.json', JSON.stringify(exported, null, 2))
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

function clearTabProxies () {
  saveTabProxyMap({})
}

function renderAbout () {
  const { name, version, description } = browser.runtime.getManifest()
  const nameEl = document.getElementById('aboutName')!
  const versionEl = document.getElementById('aboutVersion')!
  nameEl.textContent = name
  versionEl.textContent = version
  document.getElementById('aboutSummary')!.textContent = description ?? ''
}

function renderAll () {
  renderGeneral()
  renderKeepAlive()
  renderOverrides()
  renderDiagnostics()
  renderNetwork()
  renderAbout()
}


alertUnsavedChanges(window, alert)

document.addEventListener('DOMContentLoaded', async () => {
  config = await getConfig()
  browser.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== 'local') return
    config = await getConfig()
    renderKeepAlive()
    renderOverrides()
  })
  renderAll()

  if (!supportsProxyOnRequest) {
    document.getElementById('clearTabProxies')?.remove()
    document.querySelector('button[data-tab="override"]')?.remove()
    document.getElementById('override')?.remove()
    document.getElementById('aboutTabRule')?.remove()
    document.getElementById('aboutMainSiteRule')?.remove()
    document.getElementById('aboutTabAssignment')?.remove()
    document.getElementById('aboutDomainOverrides')?.remove()
    document.getElementById('networkHint')?.classList.remove('hidden')
  }

  mountDashboardFrame({
    onSectionShown: sectionId => {
      if (sectionId === 'network') renderNetwork()
    },
  })

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
  document.getElementById('addListItem')!.addEventListener('click', () => {
    const container = document.getElementById('listModalItems')!
    addListItem(container)
  })
  document.getElementById('saveList')!.addEventListener('click', saveListModal)
  document.getElementById('cancelList')!.addEventListener('click', closeListModal)
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
    const proxy = config.proxyList[idx]
    if (proxy) openProxyEditor({ entry: { proxy, position: idx } })
  })
  document.getElementById('diagTestCustom')!.addEventListener('click', () => {
    const proxy = getCustomProxyInput()
    if (proxy) runProxyTest(proxy)
  })
  document.getElementById('diagAddProxy')!.addEventListener('click', () => {
    const proxy = getCustomProxyInput()
    if (!proxy) return
    openProxyEditor({ prefill: proxy })
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
