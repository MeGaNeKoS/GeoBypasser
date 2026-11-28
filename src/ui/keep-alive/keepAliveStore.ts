import type { KeepAliveMap } from '@utils/keepAliveDraft'
import { getConfig, updateConfig } from '@utils/storage'

async function readKeepAliveMap (): Promise<KeepAliveMap> {
  return (await getConfig()).keepAliveRules ?? {}
}

export async function changeKeepAliveMap (change: (map: KeepAliveMap) => KeepAliveMap): Promise<void> {
  await updateConfig({ keepAliveRules: change(await readKeepAliveMap()) })
}
