import type { ProxyRule } from '@customTypes/proxy'
import { getConfig, updateConfig } from '@utils/storage'

export async function readRuleList (): Promise<ProxyRule[]> {
  return (await getConfig()).rules
}

export async function changeRuleList (change: (list: ProxyRule[]) => ProxyRule[] | undefined): Promise<boolean> {
  const next = change(await readRuleList())
  if (next === undefined) return false
  await saveRuleList(next)
  return true
}

export async function saveRuleList (list: ProxyRule[]): Promise<void> {
  await updateConfig({ rules: list })
}
