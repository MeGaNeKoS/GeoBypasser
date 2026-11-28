import { parseImportJson, refuseConfigFile } from '@utils/importFiles'
import { describeImported } from '@utils/importReview'
import { keepStoredCredentials } from '@utils/proxyCredentials'
import { updateConfig } from '@utils/storage'
import { reviewSectionImport } from '../review/sectionImport'

const NOT_JSON_MESSAGE = 'Configuration was not imported: the file is not valid JSON.'

export type ImportReport = {
  messages: string[];
  summary: string | null;
}

export async function importConfigFromUrl (url: string): Promise<ImportReport> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not download the configuration (HTTP ${response.status}).`)
  return importConfigText(await response.text())
}

export async function importConfigText (text: string): Promise<ImportReport> {
  const parsed = parseImportJson(text)
  if (parsed === undefined) throw new Error(NOT_JSON_MESSAGE)
  const verdict = refuseConfigFile(parsed)
  const outcome = await reviewSectionImport(stored => ({
    ...verdict.accepted,
    proxyList: keepStoredCredentials(verdict.accepted.proxyList ?? [], stored.proxyList),
  }), verdict.notes)
  if (outcome.targets) await updateConfig(outcome.targets)
  return {
    messages: outcome.messages,
    summary: outcome.added ? describeImported(outcome.added) : null,
  }
}
