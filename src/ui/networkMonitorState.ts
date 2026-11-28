import browser from 'webextension-polyfill'

export async function readTabNetworkMonitored (tabId: number): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId })
  } catch {
    return undefined
  }
}

export async function setTabMonitoring (tabId: number, monitored: boolean): Promise<void> {
  await browser.runtime.sendMessage({ type: monitored ? 'monitorTabNetwork' : 'unmonitorTabNetwork', tabId }).catch(() => {})
}
