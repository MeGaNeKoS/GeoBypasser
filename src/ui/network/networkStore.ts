import browser from 'webextension-polyfill'
import { parseNetworkUsageReply } from '@schemas/networkUsage'
import type { NetworkUsage } from '@utils/networkUsage'

export async function readNetworkUsage (): Promise<NetworkUsage> {
  const response: unknown = await browser.runtime.sendMessage({ type: 'getNetworkStats' })
  return parseNetworkUsageReply(response)
}

export async function clearNetworkUsage (): Promise<void> {
  await browser.runtime.sendMessage({ type: 'clearNetworkStats' })
}
