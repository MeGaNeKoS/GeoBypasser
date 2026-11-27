import type { ProxyListItem } from '@customTypes/proxy'
import { getConfig, updateConfig } from '@utils/storage'

export async function readProxyList (): Promise<ProxyListItem[]> {
  return (await getConfig()).proxyList
}

export async function changeProxyList (change: (list: ProxyListItem[]) => ProxyListItem[]): Promise<void> {
  await saveProxyList(change(await readProxyList()))
}

export async function saveProxyList (list: ProxyListItem[]): Promise<void> {
  await updateConfig({ proxyList: list })
}
