import { parseImportJson, refuseKeepAliveRules } from '@utils/importFiles'
import { changeKeepAliveMap } from './keepAliveStore'

const NOT_JSON_MESSAGE = 'Keep-alive rules were not imported: the file is not valid JSON.'

export async function importKeepAliveFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseKeepAliveRules((parsed as { keepAliveRules?: unknown } | null)?.keepAliveRules)
  await changeKeepAliveMap(map => ({ ...map, ...verdict.accepted }))
  return verdict.messages
}
