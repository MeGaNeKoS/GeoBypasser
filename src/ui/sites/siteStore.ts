import { getConfig, updateConfig } from '@utils/storage'
import type { SiteMap } from '@utils/siteDraft'

export async function readSiteMap (): Promise<SiteMap> {
  return (await getConfig()).perWebsiteOverride
}

export async function changeSiteMap (change: (map: SiteMap) => SiteMap): Promise<void> {
  await updateConfig({ perWebsiteOverride: change(await readSiteMap()) })
}
