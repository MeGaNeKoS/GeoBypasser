import { parseImportJson, refuseConfigFile } from '@utils/importFiles'
import { describeImported } from '@utils/importReview'
import { keepStoredCredentials } from '@utils/proxyCredentials'
import { getConfig, saveConfig } from '@utils/storage'
import { reviewSectionImport } from '../review/sectionImport'

const NOT_JSON_MESSAGE = 'Configuration was not imported: the file is not valid JSON.'

export type ImportReport = {
  messages: string[];
  summary: string | null;
}

export async function importConfigFromUrl (url: string): Promise<ImportReport> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return importConfigText(await response.text())
}

export async function importConfigText (text: string): Promise<ImportReport> {
  const parsed = parseImportJson(text)
  if (parsed === undefined) return { messages: [NOT_JSON_MESSAGE], summary: null }
  const verdict = refuseConfigFile(parsed)
  const stored = await getConfig()
  const incoming = {
    ...verdict.accepted,
    proxyList: keepStoredCredentials(verdict.accepted.proxyList ?? [], stored.proxyList),
  }
  const outcome = await reviewSectionImport(incoming, verdict.notes)
  if (outcome.targets) await saveConfig({ ...stored, ...outcome.targets })
  return {
    messages: outcome.messages,
    summary: outcome.added ? describeImported(outcome.added) : null,
  }
}
