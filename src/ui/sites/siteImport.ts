import { refuseOverrides } from '@utils/importFiles'
import { changeSiteMap } from './siteStore'

const NOT_JSON_MESSAGE = 'Sites were not imported: the file is not valid JSON.'

export async function importSiteFile (file: File): Promise<string[]> {
  const parsed = parseJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseOverrides((parsed as { perWebsiteOverride?: unknown } | null)?.perWebsiteOverride)
  await changeSiteMap(map => ({ ...map, ...verdict.accepted }))
  return verdict.messages
}

function parseJson (text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
