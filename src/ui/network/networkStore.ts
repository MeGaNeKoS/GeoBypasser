import browser from 'webextension-polyfill'
import { assertNetworkStats } from '@schemas/networkStats'
import type { NetworkStats } from '@utils/network'

export async function readNetworkStats (): Promise<NetworkStats> {
  const response: unknown = await browser.runtime.sendMessage({ type: 'getNetworkStats' })
  assertNetworkStats(response)
  return response
}

export async function clearNetworkStats (): Promise<void> {
  await browser.runtime.sendMessage({ type: 'clearNetworkStats' })
}
