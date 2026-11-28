import { formatBytes, type PathNode } from '@utils/networkUsage'
import type { RequestLogRow, ResultKind, ResultLine, RouteLine } from '@utils/requestLog'
import type { SkipRule } from '@utils/requestLogRule'
import { button } from '../components/button'
import { checkbox } from '../components/controls'
import { usageTree, type TreeNode } from '../components/tree'
import { element } from '../dom'
import { icon, type IconName } from '../icons'

export type LogRowActions = {
  chrome: boolean;
  isHostSelected: (host: string) => boolean;
  isTypeSelected: (host: string, type: string) => boolean;
  isExpanded: (key: string) => boolean;
  skipRuleFor: (row: RequestLogRow) => SkipRule | undefined;
  onToggleHost: (host: string) => void;
  onToggleType: (host: string, type: string) => void;
  onToggleExpanded: (key: string) => void;
  onSkip: (row: RequestLogRow, rule: SkipRule) => void;
};

const COLUMN_TITLES = ['Select', 'Host', 'Types', 'Results', 'Route', 'Bytes', 'Rule']
const RESULT_ICONS: Record<ResultKind, IconName> = {
  ok: 'check',
  blocked: 'alert',
  error: 'alert',
  failed: 'close',
  cache: 'info',
}
const EXPECTED_PREFIX = 'Expected: '

export function requestLogTable (rows: RequestLogRow[], actions: LogRowActions): HTMLTableElement {
  return element('table', { class: 'log-table' },
    element('thead', {}, element('tr', {}, ...COLUMN_TITLES.map(title => element('th', { scope: 'col' }, title)))),
    element('tbody', {}, ...rows.flatMap(row => logRowPair(row, actions))),
  )
}

export function routeText (line: RouteLine): string {
  return line.expected ? `${EXPECTED_PREFIX}${line.label}` : line.label
}

function logRowPair (row: RequestLogRow, actions: LogRowActions): HTMLTableRowElement[] {
  const key = expansionKey(row)
  const main = logRow(row, actions, key)
  if (!actions.isExpanded(key)) return [main]
  return [main, detailRow(row, actions)]
}

function logRow (row: RequestLogRow, actions: LogRowActions, key: string): HTMLTableRowElement {
  const rule = actions.skipRuleFor(row)
  return element('tr', {
    'data-page': row.page,
    'data-host': row.host,
    'data-types': typesText(row),
    'data-route': row.routes.map(routeText).join('; '),
    'data-rule-id': row.routes.flatMap(line => (line.ruleId === undefined ? [] : [String(line.ruleId)])).join(','),
    'data-result': row.results.map(line => line.text).join('; '),
  },
    element('td', {}, checkbox(`Select ${row.host}`, actions.isHostSelected(row.host), () => actions.onToggleHost(row.host), `select-${key}`)),
    element('td', {},
      element('span', { class: 'mono' }, row.host),
      unsizedNote(row, actions.chrome),
      button(actions.isExpanded(key) ? 'Hide details' : 'Details', {
        variant: 'quiet',
        focusKey: `details-${key}`,
        onClick: () => actions.onToggleExpanded(key),
      }),
    ),
    element('td', {}, typesText(row)),
    element('td', {}, resultList(row.results)),
    element('td', {}, routeList(row.routes)),
    element('td', { class: 'num' }, formatBytes(row.sentBytes + row.receivedBytes)),
    element('td', {}, rule ? button(`Skip in rule '${rule.name}'`, { variant: 'quiet', onClick: () => actions.onSkip(row, rule) }) : null),
  )
}

function detailRow (row: RequestLogRow, actions: LogRowActions): HTMLTableRowElement {
  return element('tr', { class: 'log-detail' },
    element('td', { colspan: COLUMN_TITLES.length },
      element('ul', { class: 'log-types' }, ...row.types.map(type => typeLine(row, type.name, type.count, actions))),
      element('p', { class: 'num' }, `Sent ${formatBytes(row.sentBytes)}, received ${formatBytes(row.receivedBytes)}`),
      usageTree(treeNodesOf(row.paths)),
    ),
  )
}

function typeLine (row: RequestLogRow, name: string, count: number, actions: LogRowActions): HTMLElement {
  const label = `${name}, ${count} requests`
  if (actions.chrome) return element('li', {}, label)
  return element('li', {}, checkbox(label, actions.isTypeSelected(row.host, name), () => actions.onToggleType(row.host, name), `type-${row.host}-${name}`))
}

function unsizedNote (row: RequestLogRow, chrome: boolean): HTMLElement | null {
  if (!chrome || row.unsizedCount === 0) return null
  return element('span', { class: 'muted' }, `${row.unsizedCount} without a size`)
}

function resultList (results: ResultLine[]): HTMLElement {
  return element('ul', { class: 'result-list' },
    ...results.map(line => element('li', { class: `result result--${line.kind}` }, icon(RESULT_ICONS[line.kind]), line.text)),
  )
}

function routeList (routes: RouteLine[]): HTMLElement {
  return element('ul', { class: 'route-list' },
    ...routes.map(line => element('li', {}, routeText(line), ` · ${line.count} requests`)),
  )
}

function typesText (row: RequestLogRow): string {
  return row.types.map(type => `${type.name} ${type.count}`).join(', ')
}

function treeNodesOf (paths: Record<string, PathNode>): TreeNode[] {
  return Object.entries(paths).map(([name, node]) => ({
    name,
    sent: formatBytes(node.sent),
    received: formatBytes(node.received),
    children: treeNodesOf(node.children),
  }))
}

export function expansionKey (row: Pick<RequestLogRow, 'page' | 'host'>): string {
  return `${row.page}|${row.host}`
}
