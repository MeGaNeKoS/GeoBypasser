import browser from 'webextension-polyfill'
import { NetworkMonitoringChangedMessageSchema } from '@schemas/messages'

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

export function onNetworkMonitoringChanged (listener: (change: { tabId: number; monitored: boolean }) => void): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const changed = NetworkMonitoringChangedMessageSchema.safeParse(message)
    if (changed.success) listener({ tabId: changed.data.tabId, monitored: changed.data.monitored })
  })
}
