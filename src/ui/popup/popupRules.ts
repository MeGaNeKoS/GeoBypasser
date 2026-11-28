import { emptyRuleListText, needsFixingLine, popupRuleRows, popupRuleSummary } from '@utils/popupView'
import type { PopupRuleRow, PopupRuleSummary, RuleFilter } from '@utils/popupView'
import { getConfig } from '@utils/storage'
import { button } from '../components/button'
import { segmented, switchControl } from '../components/controls'
import { banner } from '../components/feedback'
import { stateBody } from '../components/state-body'
import { element, replaceContent } from '../dom'
import { hashForSection, RULES_SECTION_ID, setAsideOnlyHashFor } from '../shell/routes'
import { openDashboardAt, setRuleRowActive } from './popupEffects'

const RULES_LEGEND = 'Rules'
const LOADING_COPY = { emptyTitle: '', errorTitle: 'Could not read rules' }

type RulesView = { filter: RuleFilter }

export function mountRules (slot: HTMLElement): void {
  const view: RulesView = { filter: 'active' }
  const refresh = (): Promise<void> => renderRules(slot, view, refresh)
  replaceContent(slot, [stateBody('loading', LOADING_COPY, () => [])])
  void refresh()
}

async function renderRules (slot: HTMLElement, view: RulesView, refresh: () => Promise<void>): Promise<void> {
  try {
    const rules = (await getConfig()).rules
    replaceContent(slot, rulesNodes(rules, view, refresh))
  } catch {
    replaceContent(slot, [stateBody('error', LOADING_COPY, () => [])])
  }
}

function rulesNodes (rules: unknown, view: RulesView, refresh: () => Promise<void>): Node[] {
  const summary = popupRuleSummary(rules)
  const rows = popupRuleRows(rules, view.filter)
  const state = rows.length === 0 ? 'empty' : 'populated'
  return [
    segmented(RULES_LEGEND, 'ruleFilter', [
      { value: 'active', label: `Active ${summary.active}` },
      { value: 'inactive', label: `Inactive ${summary.inactive}` },
    ], view.filter, filter => {
      view.filter = filter
      void refresh()
    }),
    stateBody(state, { emptyTitle: emptyRuleListText(summary, view.filter), errorTitle: '' }, () => [ruleList(rows, refresh)]),
    ...needsFixingNodes(summary),
  ]
}

function ruleList (rows: PopupRuleRow[], refresh: () => Promise<void>): HTMLUListElement {
  return element('ul', { class: 'popup-rules', 'aria-label': RULES_LEGEND },
    ...rows.map(row => element('li', {}, switchControl(row.name, row.active, checked => {
      void setRuleRowActive(row, checked).then(refresh)
    }))),
  )
}

function needsFixingNodes (summary: PopupRuleSummary): Node[] {
  const line = needsFixingLine(summary.needsFixing)
  if (line === null) return []
  return [banner({
    tone: 'warn',
    text: line,
    action: button('Open dashboard', {
      variant: 'quiet',
      onClick: () => void openDashboardAt(setAsideOnlyHashFor(hashForSection(RULES_SECTION_ID))),
    }),
  })]
}
