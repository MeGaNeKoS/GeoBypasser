import { refuseRules } from '@utils/importFiles'
import { changeRuleList } from './ruleStore'

const NOT_JSON_MESSAGE = 'Rules were not imported: the file is not valid JSON.'

export async function importRuleFile (file: File): Promise<string[]> {
  const parsed = parseJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseRules((parsed as { rules?: unknown } | null)?.rules)
  await changeRuleList(list => [...list, ...verdict.accepted])
  return verdict.messages
}

function parseJson (text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
