import { supportsProxyOnRequest } from '@utils/env'
import { usageRows } from '@utils/networkUsage'
import type { UsageRow } from '@utils/networkUsage'
import { button, buttonGroup } from '../components/button'
import { switchControl } from '../components/controls'
import { switchField } from '../components/fields'
import { inlineConfirm } from '../components/inline-confirm'
import { sectionHeading } from '../components/section-heading'
import { skeletonRows, stateBlock } from '../components/feedback'
import { usageTree } from '../components/tree'
import { element, replaceContent, requireElement } from '../dom'
import { NETWORK_SECTION_ID } from '../shell/routes'
import { clearNetworkStats, readNetworkStats } from './networkStore'

const CONTAINER_ID = 'networkContent'
const HEADING = 'Network'
const CHROME_NOTE = 'Chrome users: keep DevTools open to record network usage.'
const AUTO_REFRESH_LABEL = 'Auto refresh'
const AUTO_REFRESH_INTERVAL_MS = 5000
const LOADING_ROW_COUNT = 4
const LOAD_ERROR_TITLE = 'Could not read usage from the extension.'
const EMPTY_TITLE = 'No traffic recorded yet. Turn on Monitor for a tab from the popup.'
const CLEAR_QUESTION = 'Clear all usage?'
const REFRESH_KEY = 'refresh-network'
const CLEAR_KEY = 'clear-network'
const RETRY_KEY = 'retry-network'
const AUTO_REFRESH_KEY = 'auto-refresh-network'

type NetworkView =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready', rows: UsageRow[] }

let view: NetworkView = { kind: 'loading' }
let clearPending = false
let autoRefresh = false
let autoRefreshTimer: ReturnType<typeof setInterval> | undefined

export async function renderNetworkSection (focusKey?: string): Promise<void> {
  if (view.kind === 'loading') paint(focusKey)
  view = await readView()
  paint(focusKey)
}

async function readView (): Promise<NetworkView> {
  try {
    const stats = await readNetworkStats()
    return { kind: 'ready', rows: usageRows(stats.domains) }
  } catch {
    return { kind: 'error' }
  }
}

function paint (focusKey: string | undefined): void {
  replaceContent(requireElement(CONTAINER_ID), networkContent(), focusKey)
}

function networkContent (): Node[] {
  return [
    element('div', { class: 'stack' },
      sectionHeading(HEADING),
      supportsProxyOnRequest ? null : element('p', { class: 'help' }, CHROME_NOTE),
      element('div', { class: 'settings-card' },
        buttonGroup(refreshButton(), clearControl()),
        switchField({
          label: AUTO_REFRESH_LABEL,
          control: switchControl(AUTO_REFRESH_LABEL, autoRefresh, setAutoRefresh, { focusKey: AUTO_REFRESH_KEY }),
        }),
        usageBody(),
      ),
    ),
  ]
}

function usageBody (): Node {
  if (view.kind === 'loading') return skeletonRows(LOADING_ROW_COUNT)
  if (view.kind === 'error') return loadErrorBlock()
  if (view.rows.length === 0) return stateBlock({ title: EMPTY_TITLE })
  return usageTree(view.rows)
}

function loadErrorBlock (): HTMLDivElement {
  return stateBlock({
    title: LOAD_ERROR_TITLE,
    tone: 'danger',
    action: button('Retry', { focusKey: RETRY_KEY, onClick: retryLoad }),
  })
}

function retryLoad (): void {
  view = { kind: 'loading' }
  void renderNetworkSection(RETRY_KEY)
}

function refreshButton (): HTMLButtonElement {
  return button('Refresh', { focusKey: REFRESH_KEY, onClick: () => void renderNetworkSection(REFRESH_KEY) })
}

function clearControl (): HTMLElement {
  if (clearPending) return clearConfirm()
  return button('Clear', { focusKey: CLEAR_KEY, onClick: askClear })
}

function clearConfirm (): HTMLElement {
  return inlineConfirm({
    question: CLEAR_QUESTION,
    confirmLabel: 'Clear',
    groupLabel: 'Confirm clear network usage',
    pendingKey: CLEAR_KEY,
    onConfirm: confirmClear,
    onCancel: cancelClear,
  })
}

function askClear (): void {
  clearPending = true
  void renderNetworkSection(`cancel-${CLEAR_KEY}`)
}

function cancelClear (): void {
  clearPending = false
  void renderNetworkSection(CLEAR_KEY)
}

async function confirmClear (): Promise<void> {
  clearPending = false
  await clearNetworkStats().catch(() => undefined)
  await renderNetworkSection(REFRESH_KEY)
}

function setAutoRefresh (enabled: boolean): void {
  autoRefresh = enabled
  clearInterval(autoRefreshTimer)
  autoRefreshTimer = enabled ? setInterval(refreshWhenShown, AUTO_REFRESH_INTERVAL_MS) : undefined
  void renderNetworkSection(AUTO_REFRESH_KEY)
}

function refreshWhenShown (): void {
  if (!requireElement(NETWORK_SECTION_ID).classList.contains('active')) return
  void renderNetworkSection(AUTO_REFRESH_KEY)
}
