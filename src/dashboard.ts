import { getConfig } from '@utils/storage'
import browser from 'webextension-polyfill'
import { buildConfigExport } from '@utils/exportFiles'
import { keepAliveRows, overrideRows, proxyRows, ruleRows } from '@utils/pageView'
import { alertUnsavedChanges } from '@utils/saveFailure'
import { mountDashboardFrame } from '@ui/shell/frame'
import { downloadJsonFile } from '@ui/download'

let config: Awaited<ReturnType<typeof getConfig>>

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

alertUnsavedChanges(window, alert)

document.addEventListener('DOMContentLoaded', async () => {
  config = await getConfig()
  browser.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== 'local') return
    config = await getConfig()
  })

  mountDashboardFrame()

  document.getElementById('openExportConfig')!.addEventListener('click', openExportConfigModal)
  document.getElementById('exportConfigConfirm')!.addEventListener('click', exportConfigFromModal)
  document.getElementById('exportConfigCancel')!.addEventListener('click', closeExportConfigModal)
  document.getElementById('exportConfigSelectAll')!.addEventListener('click', exportConfigSelectAll)
})
