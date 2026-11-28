import { parseImportJson, refuseProxyItems } from '@utils/importFiles'
import { keepStoredCredentials } from '@utils/proxyCredentials'
import { reviewSectionImport } from '../review/sectionImport'
import { saveProxyList } from './proxyStore'

const NOT_JSON_MESSAGE = 'Proxies were not imported: the file is not valid JSON.'

export async function importProxyFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseProxyItems((parsed as { proxyList?: unknown } | null)?.proxyList)
  const outcome = await reviewSectionImport(stored => ({
    proxyList: keepStoredCredentials(verdict.accepted, stored.proxyList),
  }), verdict.notes)
  if (outcome.targets) await saveProxyList(outcome.targets.proxyList)
  return outcome.messages
}
