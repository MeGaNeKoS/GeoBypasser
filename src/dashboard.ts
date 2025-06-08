import browser from 'webextension-polyfill'
import { getConfig, saveConfig, updateConfig } from '@utils/storage'
import { APP_NAME } from '@constant/defaults'
import { ProxyListItem, ProxyRule } from '@customTypes/proxy'

let config: Awaited<ReturnType<typeof getConfig>>
let editingProxyIndex: number | null = null
let revealAllPasswords = false
const revealedPasswords = new Set<number>()

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

function renderGeneral () {
  const select = document.getElementById('defaultProxy') as HTMLSelectElement
  select.innerHTML = '<option value="">None</option>'
  config.proxyList.forEach(p => select.appendChild(createOption(p.id, p.label || p.host)))
  select.value = config.defaultProxy || ''

  const fallback = document.getElementById('fallbackDirect') as HTMLInputElement
  fallback.checked = !!config.fallbackDirect

  const testUrl = document.getElementById('testProxyUrl') as HTMLInputElement
  testUrl.value = config.testProxyUrl

  const mode = document.getElementById('storageMode') as HTMLSelectElement
  browser.storage.local.get('storageMode').then(res => {
    mode.value = res.storageMode === 'cloud' ? 'cloud' : 'local'
  })

  select.onchange = () => updateConfig({ defaultProxy: select.value || undefined })
  fallback.onchange = () => updateConfig({ fallbackDirect: fallback.checked })
  testUrl.onchange = () => updateConfig({ testProxyUrl: testUrl.value })
  mode.onchange = () => browser.storage.local.set({ storageMode: mode.value })
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
    tr.innerHTML = `<td>${r.name}</td><td>${r.match.join(', ')}</td>` +
      `<td>${r.proxyId}</td>` +
      `<td><input type="checkbox" ${r.active ? 'checked' : ''}></td>` +
      `<td><button data-remove="${idx}">Delete</button>` +
      `<button data-export="${idx}">Export</button></td>`
    tbody.appendChild(tr)
    const chk = tr.querySelector('input') as HTMLInputElement
    chk.onchange = () => { r.active = chk.checked; saveConfig(config) }
    const del = tr.querySelector('button[data-remove]') as HTMLButtonElement
    del.onclick = () => { config.rules.splice(idx,1); saveConfig(config).then(renderAll) }
    const exp = tr.querySelector('button[data-export]') as HTMLButtonElement
    exp.onclick = () => {
      const data = JSON.stringify([r], null, 2)
      download(`rule-${r.name}.json`, data)
    }
  })
}

function addRule () {
  const name = prompt('Rule name')
  if (!name) return
  const match = prompt('Match pattern (comma separated)')
  if (!match) return
  const proxyId = prompt('Proxy id')
  if (!proxyId) return
  const rule: ProxyRule = { name, match: match.split(/\s*,\s*/), proxyId, active: true }
  config.rules.push(rule)
  saveConfig(config).then(renderAll)
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

function exportRules () {
  const data = JSON.stringify(config.rules, null, 2)
  download('rules.json', data)
}

function handleImportRules (files: FileList | null) {
  if (!files || !files[0]) return
  files[0].text().then(t => {
    try {
      const arr = JSON.parse(t) as ProxyRule[]
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
  document.getElementById('exportRules')!.addEventListener('click', exportRules)
  document.getElementById('importRulesBtn')!.addEventListener('click', () =>
    document.getElementById('importRules')!.click())
  document.getElementById('importRules')!.addEventListener('change', ev =>
    handleImportRules((ev.target as HTMLInputElement).files))
  document.getElementById('exportConfig')!.addEventListener('click', exportConfig)
  document.getElementById('importConfigBtn')!.addEventListener('click', () =>
    document.getElementById('importConfig')!.click())
  document.getElementById('importConfig')!.addEventListener('change', ev =>
    handleImportConfig((ev.target as HTMLInputElement).files))
})
