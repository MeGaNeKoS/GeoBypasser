import { parseImportJson, refuseKeepAliveRules } from '@utils/importFiles'
import { reviewSectionImport } from '../review/sectionImport'
import { changeKeepAliveMap } from './keepAliveStore'

const NOT_JSON_MESSAGE = 'Keep-alive rules were not imported: the file is not valid JSON.'

export async function importKeepAliveFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseKeepAliveRules((parsed as { keepAliveRules?: unknown } | null)?.keepAliveRules)
  const outcome = await reviewSectionImport({ keepAliveRules: verdict.accepted }, verdict.notes)
  if (outcome.targets) {
    const reviewed = outcome.targets.keepAliveRules ?? {}
    await changeKeepAliveMap(() => reviewed)
  }
  return outcome.messages
}
