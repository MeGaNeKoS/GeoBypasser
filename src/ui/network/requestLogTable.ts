import { formatBytes, type PathNode } from '@utils/networkUsage'
import { formatCount, type RequestLogRow, type ResultKind, type ResultLine, type RouteLine } from '@utils/requestLog'
import type { SkipRule } from '@utils/requestLogRule'
import { button } from '../components/button'
import { checkbox, checkboxWithHiddenLabel } from '../components/controls'
import { usageTree, type TreeNode } from '../components/tree'
import { element, type Child } from '../dom'
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
}

type TableContext = {
  actions: LogRowActions;
  showActions: boolean;
}

const SELECT_COLUMN_TITLE = ''
const ACTION_COLUMN_TITLE = 'Action'
const DATA_COLUMN_TITLES = ['Host', 'Types', 'Results', 'Route', 'Bytes']
const RESULT_ICONS: Record<ResultKind, IconName> = {
  ok: 'check',
  blocked: 'alert',
  error: 'alert',
  failed: 'close',
  cache: 'info',
}
const EXPECTED_PREFIX = 'Expected: '
const FAILURE_TEXT = /^(\d+ failed:) (.+)$/
const CODE_BREAK_AFTER = /(?<=_|::)/

export function requestLogTable (rows: RequestLogRow[], actions: LogRowActions): HTMLTableElement {
  const context: TableContext = { actions, showActions: rows.some(row => actions.skipRuleFor(row) !== undefined) }
  return element('table', { class: 'log-table' },
    element('thead', {}, element('tr', {}, ...headerTitles(context).map(title => element('th', { scope: 'col' }, title)))),
    element('tbody', {}, ...rows.flatMap(row => logRowPair(row, context))),
  )
}

export function routeText (line: RouteLine): string {
  return line.expected ? `${EXPECTED_PREFIX}${line.label}` : line.label
}

function headerTitles (context: TableContext): string[] {
  const titles = [SELECT_COLUMN_TITLE, ...DATA_COLUMN_TITLES]
  return context.showActions ? [...titles, ACTION_COLUMN_TITLE] : titles
}

function logRowPair (row: RequestLogRow, context: TableContext): HTMLTableRowElement[] {
  const key = expansionKey(row)
  const main = logRow(row, context, key)
  if (!context.actions.isExpanded(key)) return [main]
  return [main, detailRow(row, context)]
}

function logRow (row: RequestLogRow, context: TableContext, key: string): HTMLTableRowElement {
  const { actions } = context
  const rule = actions.skipRuleFor(row)
  return element('tr', {
    'data-page': row.page,
    'data-host': row.host,
    'data-types': typesText(row),
    'data-route': row.routes.map(routeText).join('; '),
    'data-rule-id': row.routes.flatMap(line => (line.ruleId === undefined ? [] : [String(line.ruleId)])).join(','),
    'data-result': row.results.map(line => line.text).join('; '),
  },
    element('td', {}, hostCheckbox(row, actions, key)),
    element('td', { 'data-label': 'Host' },
      element('span', { class: 'mono log-host' }, ...hostNodes(row.host)),
      button(actions.isExpanded(key) ? 'Hide details' : 'Details', {
        variant: 'quiet',
        focusKey: `details-${key}`,
        onClick: () => actions.onToggleExpanded(key),
      }),
    ),
    element('td', { 'data-label': 'Types' }, typeList(row)),
    element('td', { 'data-label': 'Results' }, resultList(row.results)),
    element('td', { 'data-label': 'Route' }, routeList(row.routes)),
    element('td', { class: 'num', 'data-label': 'Bytes' }, bytesCell(row, actions.chrome)),
    context.showActions
      ? element('td', { 'data-label': ACTION_COLUMN_TITLE }, rule ? skipButton(row, rule, actions) : null)
      : null,
  )
}

function hostNodes (host: string): Child[] {
  return host.split('.').flatMap((label, index) => (index === 0 ? [label] : ['.', element('wbr', {}), label]));
}

function hostCheckbox (row: RequestLogRow, actions: LogRowActions, key: string): HTMLLabelElement {
  return checkboxWithHiddenLabel(row.host, actions.isHostSelected(row.host), () => actions.onToggleHost(row.host), `select-${key}`)
}

function skipButton (row: RequestLogRow, rule: SkipRule, actions: LogRowActions): HTMLButtonElement {
  return button(`Skip in rule '${rule.name}'`, { variant: 'quiet', onClick: () => actions.onSkip(row, rule) })
}

function detailRow (row: RequestLogRow, context: TableContext): HTMLTableRowElement {
  const { actions } = context
  return element('tr', { class: 'log-detail' },
    element('td', { colspan: headerTitles(context).length },
      element('ul', { class: 'log-types' }, ...row.types.map(type => typeLine(row, type.name, type.count, actions))),
      usageTree(treeNodesOf(row.paths)),
    ),
  )
}

function typeLine (row: RequestLogRow, name: string, count: number, actions: LogRowActions): HTMLElement {
  const label = `${name}, ${formatCount(count, 'request')}`
  if (actions.chrome) return element('li', {}, label)
  return element('li', {}, checkbox(label, actions.isTypeSelected(row.host, name), () => actions.onToggleType(row.host, name), `type-${row.host}-${name}`))
}

function bytesCell (row: RequestLogRow, chrome: boolean): HTMLElement {
  return element('span', { class: 'log-bytes' },
    element('span', {}, `Sent ${formatBytes(row.sentBytes)}`),
    element('span', {}, `Received ${formatBytes(row.receivedBytes)}`),
    unsizedNote(row, chrome),
  )
}

function unsizedNote (row: RequestLogRow, chrome: boolean): HTMLElement | null {
  if (!chrome || row.unsizedCount === 0) return null
  return element('span', { class: 'muted' }, `${formatCount(row.unsizedCount, 'request')} without a size`)
}

function resultList (results: ResultLine[]): HTMLElement {
  return element('ul', { class: 'result-list' },
    ...results.map(line => element('li', { class: `result result--${line.kind}` }, icon(RESULT_ICONS[line.kind]), element('span', { class: 'result-text' }, ...resultTextNodes(line.text)))),
  )
}

function resultTextNodes (text: string): Child[] {
  const parts = FAILURE_TEXT.exec(text)
  if (parts === null) return [text]
  const [, head, code] = parts
  return [element('span', { class: 'result-head' }, head), ' ', ...codeNodes(code)]
}

function codeNodes (code: string): Child[] {
  return code.split(CODE_BREAK_AFTER).flatMap((piece, index) => (index === 0 ? [piece] : [element('wbr', {}), piece]))
}

function routeList (routes: RouteLine[]): HTMLElement {
  const showCounts = routes.length > 1
  return element('ul', { class: 'route-list' },
    ...routes.map(line => element('li', {}, routeText(line), showCounts ? ` · ${formatCount(line.count, 'request')}` : null)),
  )
}

function typeList (row: RequestLogRow): HTMLElement {
  return element('ul', { class: 'type-list' },
    ...row.types.map(type => element('li', {}, `${type.name} ${type.count}`)),
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
