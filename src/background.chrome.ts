import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import browser from 'webextension-polyfill'
import { getConfig, getUserStorageMode } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { generatePacScript } from '@utils/pac'
import { APP_NAME } from '@constant/defaults'
import { getProxyTypeByChallenger } from '@utils/proxy'
import { isNetworkMessage } from '@utils/messages'
import { addNetworkData, networkStats, resetNetworkStats } from '@utils/network'

async function applyPac (config: GeoBypassRuntimeSettings) {
  const pacScript = generatePacScript(config)

  chrome.webRequest.onAuthRequired.addListener(
    (details) => {
          console.debug(`[${APP_NAME}BG] Auth required detected:`, details)

    const proxy = getProxyTypeByChallenger(
      details.challenger.host,
      details.challenger.port,
      config.proxyList,
    )

    if (proxy) {
      console.debug(
        `[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - providing credentials (username: ${proxy.username}).`)
      return {
        authCredentials: {
          username: proxy.username || '',
          password: proxy.password || '',
        },
      }
    }

    console.debug(
      `[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - no credentials found in proxy list.`)
    return {}
    },
    { urls: ['<all_urls>'] },
    ['blocking'], // Chrome only supports 'blocking', not 'asyncBlocking'
  )

  await browser.proxy.settings.set({
    value: {
      mode: 'pac_script',
      pacScript: { data: pacScript },
    },
  })
  console.info(`[${APP_NAME}BG] Applied PAC script`)
}

(async () => {
  let config = await getConfig()
  await applyPac(config)
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    const currentMode = await getUserStorageMode()
    const currentArea = currentMode === 'cloud' ? 'sync' : 'local'
    if (areaName !== currentArea) return

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

