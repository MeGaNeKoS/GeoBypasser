import browser from 'webextension-polyfill'
import { assertNetworkUsage } from '@schemas/networkUsage'
import type { NetworkUsage } from '@utils/networkUsage'

export async function readNetworkUsage (): Promise<NetworkUsage> {
  const response: unknown = await browser.runtime.sendMessage({ type: 'getNetworkStats' })
  assertNetworkUsage(response)
  return response
}

export async function clearNetworkUsage (): Promise<void> {
  await browser.runtime.sendMessage({ type: 'clearNetworkStats' })
}
