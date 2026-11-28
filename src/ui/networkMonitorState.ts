import browser from 'webextension-polyfill'

export async function readTabNetworkMonitored (tabId: number): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId })
  } catch {
    return undefined
  }
}
