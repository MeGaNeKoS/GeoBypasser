import type { WebTab } from '@utils/webTabs'
import { switchControl } from '../components/controls'
import { element } from '../dom'

export type TabMonitorRow = WebTab & { monitored: boolean }

const TITLE = 'Tabs'
const EMPTY_TITLE = 'No web page is open in a tab.'

export function tabsCard (rows: TabMonitorRow[], onToggle: (tabId: number, monitored: boolean) => void): HTMLElement {
  return element('div', { class: 'settings-card' },
    element('h3', {}, TITLE),
    rows.length === 0
      ? element('p', { class: 'help' }, EMPTY_TITLE)
      : element('ul', { class: 'tab-list' }, ...rows.map(row => tabRow(row, onToggle))),
  )
}

function tabRow (row: TabMonitorRow, onToggle: (tabId: number, monitored: boolean) => void): HTMLElement {
  return element('li', { class: 'tab-row' },
    element('span', { class: 'tab-row__page' },
      element('span', { class: 'mono' }, row.host),
      element('span', { class: 'muted' }, row.title),
    ),
    switchControl(`Monitor: ${row.host}`, row.monitored, checked => onToggle(row.id, checked), { focusKey: `monitor-tab-${row.id}` }),
  )
}
