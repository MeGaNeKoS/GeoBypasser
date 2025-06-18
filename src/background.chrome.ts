import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import browser, { WebRequest } from 'webextension-polyfill'
import { getConfig, getUserStorageMode } from '@utils/storage'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { generatePacScript } from '@utils/pac'
import { APP_NAME } from '@constant/defaults'
import { getProxyTypeByChallenger } from '@utils/proxy'

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
})()
