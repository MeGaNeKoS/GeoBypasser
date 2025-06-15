import browser from 'webextension-polyfill'
import { getConfig, getTabProxyMap, updateConfig } from '@utils/storage'
import { resolveProxy } from '@utils/proxy'
import { DIRECT_PROXY_ID } from '@constant/proxy'
import type { SetTabProxyMessage, ClearTabProxyMessage } from '@customTypes/messages'
import { testProxyConfigQueued } from '@utils/proxy'

function getHostname (url?: string) {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  const config = await getConfig()
  const tabMap = await getTabProxyMap()

  const domainEl = document.getElementById('activeDomain')!
  const host = getHostname(tab?.url)
  domainEl.textContent = host || 'N/A'

  const currentProxyEl = document.getElementById('currentProxy')!

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
    currentProxyEl.textContent = getLabel(applied)
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

  document.getElementById('setTab')?.addEventListener('click', async () => {
    if (!tab) return
    const proxyId = select.value
    const msg: SetTabProxyMessage = { type: 'setTabProxy', tabId: tab.id!, proxyId }
    await browser.runtime.sendMessage(msg)
    if (tab.id !== undefined) tabMap[tab.id] = proxyId
    updateCurrentDisplay()
  })

  document.getElementById('setDomain')?.addEventListener('click', async () => {
    if (!host) return
    const proxyId = select.value
    config.perWebsiteOverride[host] = proxyId
    await updateConfig({ perWebsiteOverride: config.perWebsiteOverride })
    updateCurrentDisplay()
  })

  document.getElementById('clearTab')?.addEventListener('click', async () => {
    if (!tab) return
    const msg: ClearTabProxyMessage = { type: 'clearTabProxy', tabId: tab.id! }
    await browser.runtime.sendMessage(msg)
    if (tab.id !== undefined) delete tabMap[tab.id]
    updateCurrentDisplay()
  })

  document.getElementById('clearDomain')?.addEventListener('click', async () => {
    if (!host) return
    delete config.perWebsiteOverride[host]
    await updateConfig({ perWebsiteOverride: config.perWebsiteOverride })
    updateCurrentDisplay()
  })

  document.getElementById('testProxy')?.addEventListener('click', async () => {
    const proxyId = select.value
    const proxy = resolveProxy(config, proxyId)
    const status = document.getElementById('status')!
    if (!proxy) { status.textContent = 'Proxy not found'; return }
    status.textContent = 'Testing...'
    await testProxyConfigQueued(proxy, config.testProxyUrl, r => {
      status.textContent = r.success ? 'Success' : `Failed: ${r.error}`
    })
  })

  document.getElementById('openDashboard')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage()
  })

  document.getElementById('closeBtn')?.addEventListener('click', () => window.close())
})
