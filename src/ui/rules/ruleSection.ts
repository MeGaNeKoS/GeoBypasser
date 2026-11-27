import type { ProxyRule } from '@customTypes/proxy'
import { getConfig } from '@utils/storage'
import { ruleRows } from '@utils/pageView'
import { ruleFormOf, storedRuleOf } from '@utils/ruleDraft'
import { exportedRules } from '@utils/ruleExport'
import { button } from '../components/button'
import { lockedSwitchText, switchControl } from '../components/controls'
import { banner } from '../components/feedback'
import { listSection } from '../components/list-section'
import type { ListRow } from '../components/list-section'
import { element, replaceContent, requireElement } from '../dom'
import { downloadJsonFile } from '../download'
import { rowTuningNodes } from './ruleFineTuning'
import { importRuleFile } from './ruleImport'
import { openRuleEditor } from './ruleSheet'
import type { RuleEntry } from './ruleSheet'
import { changeRuleList } from './ruleStore'

const RULES_CONTAINER_ID = 'rulesContent'
const RULE_IMPORT_INPUT_ID = 'ruleImportInput'
const RULES_HELP = 'Create match rules to automatically route requests through a proxy.'
const EMPTY_TEXT = 'Add a rule, or import a file of rules.'
const EXPORT_FILENAME = 'rules.json'
const NO_NAME_LABEL = '(no name)'
const CHANGED_ELSEWHERE_MESSAGE = 'This rule changed while you were editing, so your changes were not saved.'
const KEY_PREFIX = 'position-'

type RuleRow = ReturnType<typeof ruleRows>[number]

let notices: string[] = []

export async function renderRuleSection (): Promise<void> {
  const container = requireElement(RULES_CONTAINER_ID)
  const config = await getConfig()
  replaceContent(container, [element('div', { class: 'stack' }, noticeBanner(), ruleSection(config.rules, config.proxyList))])
}

function rerender (): void {
  void renderRuleSection()
}

function ruleSection (list: ProxyRule[], proxyList: unknown): HTMLElement {
  const picker = element('input', {
    id: RULE_IMPORT_INPUT_ID,
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (event: Event) => void importFrom(event),
  })
  return element('div', {}, picker, listSection({
    title: 'Rules',
    help: RULES_HELP,
    noun: 'rule',
    nounPlural: 'rules',
    addLabel: 'Add rule',
    state: 'populated',
    rows: ruleRows(list, proxyList).map(row => rowFor(list, row, proxyList)),
    empty: {
      title: 'No rules yet',
      text: EMPTY_TEXT,
      actions: [
        button('Add rule', { variant: 'primary', onClick: () => openEditor(undefined, proxyList) }),
        button('Import', { onClick: () => picker.click() }),
      ],
    },
    onAdd: () => openEditor(undefined, proxyList),
    onImport: () => picker.click(),
    onRetry: rerender,
    onRemove: keys => void removeRules(keys),
    onExport: keys => exportRules(list, keys),
  }))
}

function rowFor (list: ProxyRule[], row: RuleRow, proxyList: unknown): ListRow {
  const key = keyOf(row.index)
  const stored = storedRuleOf(list[row.index])
  const name = row.name || NO_NAME_LABEL
  return {
    id: key,
    name,
    setAside: row.invalid,
    body: [
      element('strong', {}, name),
      element('p', { class: 'help' }, matchLineOf(row.rule.match)),
      element('p', { class: 'help' }, row.proxyLabel, ...(stored ? rowTuningNodes(ruleFormOf(stored)) : [])),
      row.invalid ? lockedSwitchText(name) : switchControl(`Active: ${name}`, row.active, checked => void setActive(row.index, checked)),
    ],
    actions: [
      button('Edit', { onClick: () => openEditor({ raw: list[row.index], position: row.index, invalid: row.invalid }, proxyList) }),
    ],
  }
}

function matchLineOf (patterns: unknown): string {
  if (!Array.isArray(patterns) || patterns.length === 0) return ''
  const more = patterns.length > 1 ? ` +${patterns.length - 1} more` : ''
  return `${String(patterns[0])}${more}`
}

function openEditor (entry: RuleEntry | undefined, proxyList: unknown): void {
  openRuleEditor({ entry, proxyList, onSaved: onEditorSaved })
}

function onEditorSaved (saved: boolean): void {
  if (!saved) notices = [...notices, CHANGED_ELSEWHERE_MESSAGE]
  rerender()
}

function keyOf (index: number): string {
  return `${KEY_PREFIX}${index}`
}

async function setActive (index: number, active: boolean): Promise<void> {
  await changeRuleList(list => list.map((rule, position) =>
    position === index ? { ...storedRuleOf(rule), active } as ProxyRule : rule))
}

async function removeRules (keys: string[]): Promise<void> {
  await changeRuleList(list => list.filter((_rule, index) => !keys.includes(keyOf(index))))
}

function exportRules (list: ProxyRule[], keys: string[]): string {
  const chosen = list.filter((_rule, index) => keys.includes(keyOf(index)))
  downloadJsonFile(EXPORT_FILENAME, JSON.stringify({ rules: exportedRules(chosen, () => false) }, null, 2))
  return `Exported ${chosen.length} ${chosen.length === 1 ? 'rule' : 'rules'}.`
}

async function importFrom (event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  notices = await importRuleFile(file)
  input.value = ''
  rerender()
}

function noticeBanner (): HTMLElement | null {
  if (notices.length === 0) return null
  return banner({
    tone: 'warn',
    text: element('ul', {}, ...notices.map(message => element('li', {}, message))),
    action: button('Dismiss', { variant: 'quiet', onClick: dismissNotices }),
  })
}

function dismissNotices (): void {
  notices = []
  rerender()
}
