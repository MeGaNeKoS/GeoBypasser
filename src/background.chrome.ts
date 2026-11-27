import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyControlState } from '@customTypes/proxyControl'
import browser from 'webextension-polyfill'
import { getConfig } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { generatePacScript } from '@utils/pac'
import { APP_NAME } from '@constant/defaults'
import { createProxyAuthListener } from '@core/proxyAuth'
import { isNetworkMessage, isProxyControlMessage } from '@utils/messages'
import { addNetworkData, networkStats, resetNetworkStats } from '@utils/network'
import { canApplyPac, proxyControlStateFor } from '@utils/proxyControl'

function registerProxyAuthListener (currentConfig: () => GeoBypassRuntimeSettings) {
  chrome.webRequest.onAuthRequired.addListener(
    createProxyAuthListener(() => currentConfig().proxyList),
    { urls: ['<all_urls>'] },
    ['blocking'], // Chrome only supports 'blocking', not 'asyncBlocking'
  )
}

async function applyPac (config: GeoBypassRuntimeSettings) {
  const pacScript = generatePacScript(config)

  await browser.proxy.settings.set({
    value: {
      mode: 'pac_script',
      pacScript: { data: pacScript },
    },
  })
  console.info(`[${APP_NAME}BG] Applied PAC script`)
}

async function readProxyControlState (): Promise<ProxyControlState> {
  const setting = await browser.proxy.settings.get({})
  return proxyControlStateFor(setting.levelOfControl)
}

async function broadcastProxyControlState (state: ProxyControlState) {
  await browser.runtime.sendMessage({ type: 'proxyControlChanged', state })
    .catch(() => console.debug(`[${APP_NAME}BG] No extension page is listening for the proxy control state`))
}

function watchProxyControl (currentConfig: () => GeoBypassRuntimeSettings) {
  browser.proxy.settings.onChange.addListener(async details => {
    const state = proxyControlStateFor(details.levelOfControl)
    if (canApplyPac(state)) await applyPac(currentConfig())
    await broadcastProxyControlState(state)
  })
}

function answerProxyControlRequests () {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isProxyControlMessage(message) || message.type !== 'getProxyControl') return undefined
    return readProxyControlState().then(state => ({ state }))
  })
}

(async () => {
  let config = await getConfig()
  const currentConfig = () => config
  registerProxyAuthListener(currentConfig)
  watchProxyControl(currentConfig)
  answerProxyControlRequests()
  await applyPac(config)
  await broadcastProxyControlState(await readProxyControlState())
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return

    if (Object.keys(changes).some(k => Object.values(STORAGE_KEYS).includes(k as any))) {
      config = await getConfig()
      await applyPac(config)
    }
  })

  const monitoredTabs = new Set<number>()
  const requestSizes = new Map<string | number, number>()

  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      if (!monitoredTabs.has(details.tabId)) return
      const header = details.requestHeaders?.find(h => h.name.toLowerCase() === 'content-length')
      if (!header) return
      const size = parseInt(header.value || '0', 10)
      if (!isNaN(size)) requestSizes.set(details.requestId, size)
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders']
  )

  browser.webRequest.onCompleted.addListener(
    details => {
      if (!monitoredTabs.has(details.tabId)) {
        requestSizes.delete(details.requestId)
        return
      }
      const sent = requestSizes.get(details.requestId) || 0
      requestSizes.delete(details.requestId)
      const received = (details as any).encodedDataLength || 0
      addNetworkData(details.url, sent, received)
    },
    { urls: ['<all_urls>'] }
  )

  browser.webRequest.onErrorOccurred.addListener(
    details => {
      if (monitoredTabs.has(details.tabId)) requestSizes.delete(details.requestId)
    },
    { urls: ['<all_urls>'] }
  )

  browser.runtime.onMessage.addListener(async (message: unknown) => {
    if (!isNetworkMessage(message)) return
    if (message.type === 'getNetworkStats') return networkStats
    if (message.type === 'clearNetworkStats') { resetNetworkStats(); return }
    if (message.type === 'monitorTabNetwork') { monitoredTabs.add(message.tabId); return }
    if (message.type === 'unmonitorTabNetwork') { monitoredTabs.delete(message.tabId); return }
    if (message.type === 'isTabNetworkMonitored') return monitoredTabs.has(message.tabId)
    if (message.type === 'devtoolsNetworkData') {
      if (monitoredTabs.has(message.tabId)) {
        addNetworkData(message.url, message.sentSize, message.receivedSize)
      }
    }
  })

  browser.tabs.onRemoved.addListener(tabId => {
    monitoredTabs.delete(tabId)
  })
})()

