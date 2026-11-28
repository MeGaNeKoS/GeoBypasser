import { parseImportJson, refuseKeepAliveRules } from '@utils/importFiles'
import { duplicateKeysOf, mapAfterImport } from '@utils/mapImport'
import { storedProxyLabel } from '@utils/pageView'
import { getConfig } from '@utils/storage'
import { askReplacements } from '../components/duplicate-sheet'
import { changeKeepAliveMap } from './keepAliveStore'

const NOT_JSON_MESSAGE = 'Keep-alive rules were not imported: the file is not valid JSON.'

export async function importKeepAliveFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseKeepAliveRules((parsed as { keepAliveRules?: unknown } | null)?.keepAliveRules)
  const { keepAliveRules = {}, proxyList } = await getConfig()
  const replaced = await askReplacements(
    duplicateKeysOf(keepAliveRules, verdict.accepted),
    proxyId => `${storedProxyLabel(proxyList, proxyId) ?? proxyId} already has a keep-alive rule.`,
  )
  await changeKeepAliveMap(map => mapAfterImport(map, verdict.accepted, replaced))
  return verdict.notes.map(note => note.text)
}
