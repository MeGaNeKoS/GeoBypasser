import { element } from '@ui/dom'
import { icon } from '@ui/icons'
import { segmented, switchControl, type SegmentOption } from '@ui/components/controls'
import { rules } from './sample-data'
import type { ListState, RuleEntry } from './model'

export type Rerender = (focusKey?: string) => void

type RuleFilter = 'active' | 'inactive'

let ruleFilter: RuleFilter = 'active'

export function popupRules (listState: ListState, rerender: Rerender): HTMLElement {
  if (listState === 'empty') {
    return element('section', { class: 'popup__block popup__rules stack' },
      element('h2', { class: 'group-label' }, 'Rules'),
      element('p', { class: 'help' }, 'No rules yet. ', element('a', { href: 'index.html#rules' }, 'Open dashboard')),
    )
  }
  const activeCount = rules.filter(rule => rule.active).length
  return element('section', { class: 'popup__block popup__rules stack' },
    element('div', { class: 'popup__rules-head' },
      element('h2', { class: 'group-label' }, 'Rules'),
      segmented('Show rules', 'popup-rule-filter', filterOptions(activeCount, rules.length - activeCount), ruleFilter, value => {
        ruleFilter = value
        rerender()
      }),
    ),
    ruleList(rulesForFilter(ruleFilter), rerender),
    faultLine(),
  )
}

function filterOptions (activeCount: number, inactiveCount: number): SegmentOption<RuleFilter>[] {
  return [
    { value: 'active', label: `Active ${activeCount}` },
    { value: 'inactive', label: `Inactive ${inactiveCount}` },
  ]
}

function rulesForFilter (filter: RuleFilter): RuleEntry[] {
  return rules.filter(rule => rule.active === (filter === 'active'))
}

function ruleList (entries: RuleEntry[], rerender: Rerender): HTMLElement {
  if (entries.length === 0) {
    return element('p', { class: 'help' }, ruleFilter === 'active' ? 'No active rules' : 'No inactive rules')
  }
  return element('ul', { class: 'popup__rule-list' }, ...entries.map(rule => ruleItem(rule, rerender)))
}

function ruleItem (rule: RuleEntry, rerender: Rerender): HTMLLIElement {
  const field = `rule-${rule.id}`
  const name = rule.name || '(no name)'
  return element('li', { class: 'popup__rule' },
    switchControl(name, rule.active, checked => {
      rule.active = checked
      rerender(field)
    }, { field, focusKey: field }),
    element('span', { class: 'popup__rule-name' }, name),
  )
}

function faultLine (): HTMLElement | null {
  const faulty = rules.filter(rule => rule.faults.length > 0).length
  if (faulty === 0) return null
  return element('p', { class: 'popup__fault-line', role: 'status' },
    icon('alert'),
    `${faulty} ${faulty === 1 ? 'rule needs' : 'rules need'} fixing. `,
    element('a', { href: 'index.html#rules' }, 'Open dashboard'),
  )
}
