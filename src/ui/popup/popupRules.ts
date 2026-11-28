import { emptyRuleListText, needsFixingLine, popupRuleRows, popupRuleSummary } from '@utils/popupView'
import type { PopupRuleRow, PopupRuleSummary, RuleFilter } from '@utils/popupView'
import { getConfig } from '@utils/storage'
import { linkButton } from '../components/button'
import { segmented, switchControl } from '../components/controls'
import { banner } from '../components/feedback'
import { stateBody } from '../components/state-body'
import { element, replaceContent } from '../dom'
import { hashForSection, RULES_SECTION_ID, setAsideOnlyHashFor } from '../shell/routes'
import { openDashboardAt, setRuleRowActive } from './popupEffects'

const RULES_LEGEND = 'Rules'
const LOADING_COPY = { emptyTitle: '', errorTitle: 'Could not read rules' }

type RulesView = { filter: RuleFilter }
type RulesRefresh = (focusKey?: string) => Promise<void>

export function mountRules (slot: HTMLElement): void {
  const view: RulesView = { filter: 'active' }
  const refresh: RulesRefresh = focusKey => renderRules(slot, view, refresh, focusKey)
  replaceContent(slot, [stateBody('loading', LOADING_COPY, () => [])])
  void refresh()
}

async function renderRules (slot: HTMLElement, view: RulesView, refresh: RulesRefresh, focusKey?: string): Promise<void> {
  try {
    const rules = (await getConfig()).rules
    replaceContent(slot, rulesNodes(rules, view, refresh), focusKey)
  } catch {
    replaceContent(slot, [stateBody('error', LOADING_COPY, () => [])])
  }
}

function rulesNodes (rules: unknown, view: RulesView, refresh: RulesRefresh): Node[] {
  const summary = popupRuleSummary(rules)
  const rows = popupRuleRows(rules, view.filter)
  return [
    rulesHeader(summary, view, refresh),
    rows.length === 0 ? emptyRulesLine(summary, view.filter) : ruleList(rows, view.filter, refresh),
    ...needsFixingNodes(summary),
  ]
}

function rulesHeader (summary: PopupRuleSummary, view: RulesView, refresh: RulesRefresh): HTMLDivElement {
  return element('div', { class: 'popup-rules-head' },
    element('h2', { class: 'popup-heading' }, RULES_LEGEND),
    segmented(RULES_LEGEND, 'ruleFilter', [
      { value: 'active', label: `Active ${summary.active}` },
      { value: 'inactive', label: `Inactive ${summary.inactive}` },
    ], view.filter, filter => {
      view.filter = filter
      void refresh()
    }),
  )
}

function emptyRulesLine (summary: PopupRuleSummary, filter: RuleFilter): HTMLParagraphElement {
  const text = emptyRuleListText(summary, filter)
  if (summary.total > 0) return element('p', { class: 'popup-empty' }, text)
  return element('p', { class: 'popup-empty' }, text, ' ', linkButton('Open dashboard', openRulesInDashboard))
}

function openRulesInDashboard (): void {
  void openDashboardAt(setAsideOnlyHashFor(hashForSection(RULES_SECTION_ID)))
}

function ruleList (rows: PopupRuleRow[], filter: RuleFilter, refresh: RulesRefresh): HTMLUListElement {
  return element('ul', { class: 'popup-rules', 'aria-label': RULES_LEGEND },
    ...rows.map((row, index) => element('li', {},
      switchControl(row.name, row.active, checked => {
        const focusKey = focusKeyAfterFlip(rows, index, filter)
        void setRuleRowActive(row, checked).then(() => refresh(focusKey))
      }, { focusKey: ruleRowFocusKey(row.position) }),
      element('span', { class: 'popup-rule__name' }, row.name),
    )),
  )
}

function focusKeyAfterFlip (rows: PopupRuleRow[], index: number, filter: RuleFilter): string {
  const neighbour = rows[index + 1] ?? rows[index - 1]
  return neighbour === undefined ? filterOptionFocusKey(filter) : ruleRowFocusKey(neighbour.position)
}

function ruleRowFocusKey (position: number): string {
  return `rule-${position}`
}

function filterOptionFocusKey (filter: RuleFilter): string {
  return `ruleFilter-${filter}`
}

function needsFixingNodes (summary: PopupRuleSummary): Node[] {
  const line = needsFixingLine(summary.needsFixing)
  if (line === null) return []
  return [banner({
    tone: 'warn',
    text: line,
    action: linkButton('Open dashboard', openRulesInDashboard),
  })]
}
