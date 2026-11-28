import { parseImportJson, refuseRules } from '@utils/importFiles'
import { reviewSectionImport } from '../review/sectionImport'
import { saveRuleList } from './ruleStore'

const NOT_JSON_MESSAGE = 'Rules were not imported: the file is not valid JSON.'

export async function importRuleFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseRules((parsed as { rules?: unknown } | null)?.rules)
  const outcome = await reviewSectionImport({ rules: verdict.accepted }, verdict.notes)
  if (outcome.targets) await saveRuleList(outcome.targets.rules)
  return outcome.messages
}
