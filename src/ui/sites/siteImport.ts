import { parseImportJson, refuseOverrides } from '@utils/importFiles'
import { duplicateKeysOf, mapAfterImport } from '@utils/mapImport'
import { askReplacements } from '../components/duplicate-sheet'
import { changeSiteMap, readSiteMap } from './siteStore'

const NOT_JSON_MESSAGE = 'Sites were not imported: the file is not valid JSON.'

export async function importSiteFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseOverrides((parsed as { perWebsiteOverride?: unknown } | null)?.perWebsiteOverride)
  const replaced = await askReplacements(
    duplicateKeysOf(await readSiteMap(), verdict.accepted),
    domain => `${domain} already has a site entry.`,
  )
  await changeSiteMap(map => mapAfterImport(map, verdict.accepted, replaced))
  return verdict.notes.map(note => note.text)
}
