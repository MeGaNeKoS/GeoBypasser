import browser from 'webextension-polyfill'
import { NetworkMonitoringChangedMessageSchema } from '@schemas/messages'
import type { TabSummary } from '@utils/webTabs'

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

export function readOpenTabs (): Promise<TabSummary[]> {
  return browser.tabs.query({})
}

export function onNetworkMonitoringChanged (listener: (change: { tabId: number; monitored: boolean }) => void): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const changed = NetworkMonitoringChangedMessageSchema.safeParse(message)
    if (changed.success) listener({ tabId: changed.data.tabId, monitored: changed.data.monitored })
  })
}

export function onOpenTabsChanged (listener: () => void): () => void {
  const onTabSetChanged = () => listener()
  const onTabUpdated = (_tabId: number, change: { url?: string; title?: string }) => {
    if (change.url !== undefined || change.title !== undefined) listener()
  }
  browser.tabs.onCreated.addListener(onTabSetChanged)
  browser.tabs.onRemoved.addListener(onTabSetChanged)
  browser.tabs.onUpdated.addListener(onTabUpdated)
  return () => {
    browser.tabs.onCreated.removeListener(onTabSetChanged)
    browser.tabs.onRemoved.removeListener(onTabSetChanged)
    browser.tabs.onUpdated.removeListener(onTabUpdated)
  }
}
