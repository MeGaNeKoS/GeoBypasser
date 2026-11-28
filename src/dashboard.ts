import {
  getConfig,
  saveConfig,
} from '@utils/storage'
import { ProxyListItem, ProxyRule } from '@customTypes/proxy'
import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import type { GeoBypassSettings } from '@customTypes/settings'
import { formatBytes, NetworkStats, NetworkStatsNode } from '@utils/network'
import { findSettingChanges, refuseConfigFile, withAppliedSettings } from '@utils/importFiles'
import { chooseAppliedSettingChanges } from './settingChangeModal'
import { keepStoredCredentials } from '@utils/proxyCredentials'
import { buildConfigExport } from '@utils/exportFiles'
import { isValidProxyItem } from '@utils/validity'
import { keepAliveRows, overrideRows, proxyRows, ruleRows } from '@utils/pageView'
import { alertUnsavedChanges } from '@utils/saveFailure'
import { mountDashboardFrame } from '@ui/shell/frame'
import { downloadJsonFile } from '@ui/download'

let config: Awaited<ReturnType<typeof getConfig>>
let networkAutoInterval: ReturnType<typeof setInterval> | null = null

// Helper to generate a signature for comparing proxy entries

function proxySignature (p: ProxyListItem) {
  return `${p.type}-${p.host}:${p.port}-${p.username || ''}`
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
  alertImportMessages(verdict.notes.map(note => note.text))
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

function renderAll () {
  renderNetwork()
}


alertUnsavedChanges(window, alert)

document.addEventListener('DOMContentLoaded', async () => {
  config = await getConfig()
  browser.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== 'local') return
    config = await getConfig()
  })
  renderAll()

  if (!supportsProxyOnRequest) {
    document.getElementById('networkHint')?.classList.remove('hidden')
  }

  mountDashboardFrame({
    onSectionShown: sectionId => {
      if (sectionId === 'network') renderNetwork()
    },
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
