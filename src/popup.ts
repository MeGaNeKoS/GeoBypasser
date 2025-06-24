import browser from 'webextension-polyfill'
import { getConfig, getTabProxyMap, updateConfig } from '@utils/storage'
import { resolveProxy } from '@utils/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import type { SetTabProxyMessage, ClearTabProxyMessage } from '@customTypes/messages'
import { testProxyConfigQueued } from '@utils/proxy'
import { supportsProxyOnRequest } from '@utils/env'

function getHostname (url?: string) {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (/android|iphone|ipad|mobile/i.test(navigator.userAgent)) {
    document.body.classList.add('mobile-popup')
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  const config = await getConfig()
  const tabMap = await getTabProxyMap()

  const domainEl = document.getElementById('activeDomain')!
  const host = getHostname(tab?.url)
  domainEl.textContent = host || 'N/A'

  const currentProxyEl = document.getElementById('currentProxy') as HTMLElement | null

  if (!supportsProxyOnRequest) {
    document.getElementById('controls')?.remove()
    document.getElementById('testProxy')?.remove()
    currentProxyEl?.parentElement?.remove()
    // Show hint about devtools requirement for Chrome network monitoring
    document.getElementById('monitorHint')?.classList.remove('hidden')
  } else {
    if (!currentProxyEl) return
    const currentProxy = currentProxyEl
    const scopeSelect = document.getElementById('scopeSelect') as HTMLSelectElement
    const setBtn = document.getElementById('setProxy') as HTMLButtonElement
    const clearBtn = document.getElementById('clearProxy') as HTMLButtonElement


  function getLabel (id?: string | null) {
    if (!id) return 'None'
    if (id === DIRECT_PROXY_ID) return 'Direct'
    const p = resolveProxy(config, id)
    return p ? (p.label || `${p.host}:${p.port}`) : 'None'
  }

  function updateCurrentDisplay () {
    const tabIdProxy = tab?.id !== undefined ? tabMap[tab.id] : undefined
    const domainProxy = host ? config.perWebsiteOverride[host] : undefined
    const applied = tabIdProxy ?? domainProxy
    currentProxy.textContent = getLabel(applied)
    select.value = applied || config.defaultProxy || DIRECT_PROXY_ID
  }

  const select = document.getElementById('proxySelect') as HTMLSelectElement
  const directOpt = document.createElement('option')
  directOpt.value = DIRECT_PROXY_ID
  directOpt.textContent = 'Direct'
  select.appendChild(directOpt)

  for (const proxy of config.proxyList) {
    const opt = document.createElement('option')
    opt.value = proxy.id
    opt.textContent = proxy.label || `${proxy.host}:${proxy.port}`
    select.appendChild(opt)
  }
  updateCurrentDisplay()

  setBtn.addEventListener('click', async () => {
    const proxyId = select.value
    if (scopeSelect.value === 'tab') {
      if (!tab) return
      const msg: SetTabProxyMessage = { type: 'setTabProxy', tabId: tab.id!, proxyId }
      await browser.runtime.sendMessage(msg).catch(() => {})
      if (tab.id !== undefined) tabMap[tab.id] = proxyId
    } else if (scopeSelect.value === 'site') {
      if (!host) return
      config.perWebsiteOverride[host] = proxyId
      await updateConfig({ perWebsiteOverride: config.perWebsiteOverride })
    }
    updateCurrentDisplay()
  })

  clearBtn.addEventListener('click', async () => {
    if (scopeSelect.value === 'tab') {
      if (!tab) return
      const msg: ClearTabProxyMessage = { type: 'clearTabProxy', tabId: tab.id! }
      await browser.runtime.sendMessage(msg).catch(() => {})
      if (tab.id !== undefined) delete tabMap[tab.id]
    } else if (scopeSelect.value === 'site') {
      if (!host) return
      delete config.perWebsiteOverride[host]
      await updateConfig({ perWebsiteOverride: config.perWebsiteOverride })
    }
    updateCurrentDisplay()
  })

  document.getElementById('testProxy')?.addEventListener('click', async () => {
    const proxyId = select.value
    const proxy = resolveProxy(config, proxyId)
    const status = document.getElementById('status')!
    if (!proxy) { status.textContent = 'Proxy not found'; return }
    status.textContent = 'Testing...'
    await testProxyConfigQueued(proxy, config.testProxyUrl, r => {
      status.textContent = r.success ? `Success connect through ${r.proxy}` : `Failed: ${r.error}`
    })
  })

}

  const toggleMonitor = document.getElementById('toggleMonitor') as HTMLButtonElement | null
  let monitorSupported = true

  async function updateMonitorLabel () {
    if (!toggleMonitor || !tab || tab.id === undefined) return
    let monitored = false
    try {
      monitored = await browser.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId: tab.id })
    } catch {
      monitorSupported = false
      toggleMonitor.remove()
      return
    }
    toggleMonitor.textContent = monitored ? 'Stop Monitoring' : 'Monitor Tab'
  }

  toggleMonitor?.addEventListener('click', async () => {
    if (!monitorSupported || !tab || tab.id === undefined || !toggleMonitor) return
    let monitored = false
    try {
      monitored = await browser.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId: tab.id })
    } catch {
      monitorSupported = false
      toggleMonitor.remove()
      return
    }
    if (monitored) {
      await browser.runtime.sendMessage({ type: 'unmonitorTabNetwork', tabId: tab.id }).catch(() => {})
    } else {
      await browser.runtime.sendMessage({ type: 'monitorTabNetwork', tabId: tab.id }).catch(() => {})
    }
    updateMonitorLabel()
  })

  updateMonitorLabel()

  const ruleList = document.getElementById('ruleList') as HTMLUListElement | null
  const ruleHeader = document.querySelectorAll<HTMLButtonElement>(
    '#ruleHeader button[data-list]'
  )

  function toPlainRules () {
    return config.rules.map(r => ({
      active: r.active,
      name: r.name,
      match: r.match,
      bypassUrlPatterns: r.bypassUrlPatterns,
      bypassResourceTypes: r.bypassResourceTypes,
      staticExtensions: r.staticExtensions,
      forceProxyUrlPatterns: r.forceProxyUrlPatterns,
      fallbackDirect: r.fallbackDirect,
      proxyId: r.proxyId,
    }))
  }

  async function saveRules () {
    await updateConfig({ rules: toPlainRules() })
  }

  function renderRuleList (showActive: boolean) {
    if (!ruleList) return
    ruleList.innerHTML = ''
    const rules = config.rules
      .filter(r => (showActive ? r.active : !r.active))
      .slice(0, 5)
    if (rules.length === 0) {
      const li = document.createElement('li')
      li.textContent = 'No rules'
      ruleList.appendChild(li)
      return
    }
    rules.forEach(r => {
      const li = document.createElement('li')

      const toggle = document.createElement('input')
      toggle.type = 'checkbox'
      toggle.checked = r.active
      toggle.addEventListener('change', async () => {
        r.active = toggle.checked
        await saveRules()
        renderRuleList(currentList === 'active')
      })

      const name = document.createElement('span')
      name.textContent = r.name

      li.appendChild(toggle)
      li.appendChild(name)
      ruleList.appendChild(li)
    })
  }

  let currentList: 'active' | 'inactive' = 'active'
  ruleHeader.forEach(btn => {
    btn.addEventListener('click', () => {
      currentList = btn.dataset.list === 'inactive' ? 'inactive' : 'active'
      ruleHeader.forEach(b => b.classList.toggle('active', b === btn))
      renderRuleList(currentList === 'active')
    })
  })

  renderRuleList(true)

  document.getElementById('openDashboard')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage()
  })

  document.getElementById('closeBtn')?.addEventListener('click', () => window.close())
})
