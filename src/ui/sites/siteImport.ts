import { parseImportJson, refuseOverrides } from '@utils/importFiles'
import { reviewSectionImport } from '../review/sectionImport'
import { changeSiteMap } from './siteStore'

const NOT_JSON_MESSAGE = 'Sites were not imported: the file is not valid JSON.'

export async function importSiteFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseOverrides((parsed as { perWebsiteOverride?: unknown } | null)?.perWebsiteOverride)
  const outcome = await reviewSectionImport(() => ({ perWebsiteOverride: verdict.accepted }), verdict.notes)
  if (outcome.targets) {
    const reviewed = outcome.targets.perWebsiteOverride
    await changeSiteMap(() => reviewed)
  }
  return outcome.messages
}
