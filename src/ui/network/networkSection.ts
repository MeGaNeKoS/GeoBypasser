import type { ProxyRule } from '@customTypes/proxy'
import { supportsProxyOnRequest } from '@utils/env'
import { requestLogPages, type RequestLogPage, type RequestLogRow } from '@utils/requestLog'
import {
  ruleFormForSelection,
  ruleFormSkippingHost,
  selectionOnPage,
  skippableRuleOf,
  withHostToggled,
  withTypeToggled,
  type LogSelection,
  type SkipRule,
} from '@utils/requestLogRule'
import { webTabsOf } from '@utils/webTabs'
import { getConfig } from '@utils/storage'
import { button, buttonGroup } from '../components/button'
import { switchControl } from '../components/controls'
import { switchField } from '../components/fields'
import { inlineConfirm } from '../components/inline-confirm'
import { sectionHeading } from '../components/section-heading'
import { banner, skeletonRows, stateBlock } from '../components/feedback'
import { element, replaceContent, requireElement } from '../dom'
import { NETWORK_SECTION_ID } from '../shell/routes'
import { openRuleEditor } from '../rules/ruleSheet'
import { onNetworkMonitoringChanged, onOpenTabsChanged, readOpenTabs, readTabNetworkMonitored, setTabMonitoring } from '../networkMonitorState'
import { clearNetworkUsage, readNetworkUsage } from './networkStore'
import { requestLogPageGroup, type PageGroupOptions } from './requestLogPage'
import { expansionKey, type LogRowActions } from './requestLogTable'
import { tabsCard, type TabMonitorRow } from './tabsCard'

const CONTAINER_ID = 'networkContent'
const HEADING = 'Network'
const CHROME_NOTE = 'Chrome does not report the route each request used. Routes shown are the ones your settings expect.'
const AUTO_REFRESH_LABEL = 'Auto refresh'
const AUTO_REFRESH_INTERVAL_MS = 5000
const OPEN_TABS_DEBOUNCE_MS = 250
const LOADING_ROW_COUNT = 4
const LOAD_ERROR_TITLE = 'Could not read usage from the extension.'
const NO_TRAFFIC_TITLE = 'No traffic recorded yet. Turn on a tab above, or use Monitor this tab in the popup.'
const CLEAR_QUESTION = 'Clear all usage?'
const REFRESH_KEY = 'refresh-network'
const CLEAR_FAILED_TEXT = 'Could not clear network usage.'
const TRY_AGAIN_LABEL = 'Try again'
const CLEAR_KEY = 'clear-network'
const TRY_AGAIN_KEY = 'try-again-clear-network'
const RETRY_KEY = 'retry-network'
const AUTO_REFRESH_KEY = 'auto-refresh-network'
const COPY_JSON_LABEL = 'Copy as JSON'
const COPY_JSON_KEY = 'copy-network-json'

type ReadyView = {
  kind: 'ready';
  tabs: TabMonitorRow[];
  pages: RequestLogPage[];
  rules: ProxyRule[];
  proxyList: unknown;
  chrome: boolean;
};

type NetworkView =
  | { kind: 'loading' }
  | { kind: 'error' }
  | ReadyView;

let view: NetworkView = { kind: 'loading' };
let selection: LogSelection | undefined;
const expandedRows = new Set<string>();
let clearPending = false;
let clearFailed = false;
let autoRefresh = false;
let autoRefreshTimer: ReturnType<typeof setInterval> | undefined;

let stopWatchingOpenTabs: (() => void) | undefined;
let openTabsDebounceTimer: ReturnType<typeof setTimeout> | undefined;

export async function renderNetworkSection (focusKey?: string): Promise<void> {
  stopWatchingOpenTabs ??= onOpenTabsChanged(refreshAfterOpenTabsChange);
  if (view.kind === 'loading') paint(focusKey);
  view = await readView();
  paint(focusKey);
}

async function readView (): Promise<NetworkView> {
  try {
    const [usage, tabs, config] = await Promise.all([readNetworkUsage(), readOpenTabs(), getConfig()]);
    const webTabs = webTabsOf(tabs);
    const monitored = await Promise.all(webTabs.map(tab => readTabNetworkMonitored(tab.id)));
    return {
      kind: 'ready',
      tabs: webTabs.map((tab, index) => ({ ...tab, monitored: monitored[index] === true })),
      pages: requestLogPages(usage),
      rules: config.rules,
      proxyList: config.proxyList,
      chrome: !supportsProxyOnRequest,
    };
  } catch {
    return { kind: 'error' };
  }
}

function paint (focusKey: string | undefined): void {
  replaceContent(requireElement(CONTAINER_ID), networkContent(), focusKey);
}

function networkContent (): Node[] {
  return [
    element('div', { class: 'stack' },
      sectionHeading(HEADING),
      clearFailed ? clearFailedBanner() : null,
      element('div', { class: 'settings-card' },
        buttonGroup(refreshButton(), clearControl()),
        switchField({
          label: AUTO_REFRESH_LABEL,
          control: switchControl(AUTO_REFRESH_LABEL, autoRefresh, setAutoRefresh, { focusKey: AUTO_REFRESH_KEY }),
        }),
      ),
      ...bodyNodes(),
    ),
  ];
}

function bodyNodes (): Node[] {
  if (view.kind === 'loading') return [skeletonRows(LOADING_ROW_COUNT)];
  if (view.kind === 'error') return [loadErrorBlock()];
  return [
    tabsCard(view.tabs, toggleMonitoring),
    ...(view.chrome ? [banner({ tone: 'info', text: CHROME_NOTE })] : []),
    ...logNodes(view),
  ];
}

function logNodes (ready: ReadyView): Node[] {
  if (ready.pages.length === 0) return [stateBlock({ title: emptyLogTitle(ready) })];
  return [
    button(COPY_JSON_LABEL, { variant: 'quiet', focusKey: COPY_JSON_KEY, onClick: () => void copyPagesAsJson(ready.pages) }),
    ...ready.pages.map(page => requestLogPageGroup(page, pageGroupOptions(ready, page))),
  ];
}

function emptyLogTitle (ready: ReadyView): string {
  const monitoring = ready.tabs.filter(tab => tab.monitored).length;
  if (monitoring === 0) return NO_TRAFFIC_TITLE;
  return `Monitoring ${monitoring} tabs. Nothing recorded yet. Load or reload the page.`;
}

function pageGroupOptions (ready: ReadyView, page: RequestLogPage): PageGroupOptions {
  const onPage = selectionOnPage(selection, page.page);
  return {
    canCreateRule: onPage.hosts.length > 0,
    onCreateRule: () => createRuleFromSelection(ready, page.page),
    rowActions: rowActionsFor(ready, page.page, onPage),
  };
}

function rowActionsFor (ready: ReadyView, page: string, onPage: LogSelection): LogRowActions {
  return {
    chrome: ready.chrome,
    isHostSelected: host => onPage.hosts.includes(host),
    isTypeSelected: (host, type) => onPage.types.some(entry => entry.host === host && entry.type === type),
    isExpanded: key => expandedRows.has(key),
    skipRuleFor: row => skippableRuleOf(row, ready.rules),
    onToggleHost: host => toggleHost(page, host),
    onToggleType: (host, type) => toggleType(page, host, type),
    onToggleExpanded: key => toggleExpanded(key),
    onSkip: (row, rule) => skipHostInRule(ready, row, rule),
  };
}

function toggleHost (page: string, host: string): void {
  selection = withHostToggled(selectionOnPage(selection, page), host);
  void renderNetworkSection(`select-${expansionKey({ page, host })}`);
}

function toggleType (page: string, host: string, type: string): void {
  selection = withTypeToggled(selectionOnPage(selection, page), host, type);
  void renderNetworkSection(`type-${host}-${type}`);
}

function toggleExpanded (key: string): void {
  if (expandedRows.has(key)) expandedRows.delete(key);
  else expandedRows.add(key);
  void renderNetworkSection(`details-${key}`);
}

function toggleMonitoring (tabId: number, monitored: boolean): void {
  void setTabMonitoring(tabId, monitored).then(() => renderNetworkSection(`monitor-tab-${tabId}`));
}

function createRuleFromSelection (ready: ReadyView, page: string): void {
  openRuleEditor({
    proxyList: ready.proxyList,
    prefill: () => ruleFormForSelection(selectionOnPage(selection, page), !ready.chrome),
    onSaved: afterRuleSaved,
  });
}

function skipHostInRule (ready: ReadyView, row: RequestLogRow, rule: SkipRule): void {
  openRuleEditor({
    entry: { raw: ready.rules[rule.index], position: rule.index, invalid: false },
    proxyList: ready.proxyList,
    prefill: form => ruleFormSkippingHost(form, row.host),
    onSaved: afterRuleSaved,
  });
}

function afterRuleSaved (saved: boolean): void {
  if (!saved) return;
  selection = undefined;
  void renderNetworkSection();
}

async function copyPagesAsJson (pages: RequestLogPage[]): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(pages, null, 2));
}

function clearFailedBanner (): HTMLDivElement {
  return banner({
    tone: 'danger',
    text: CLEAR_FAILED_TEXT,
    action: button(TRY_AGAIN_LABEL, { focusKey: TRY_AGAIN_KEY, onClick: () => void confirmClear() }),
  });
}

function loadErrorBlock (): HTMLDivElement {
  return stateBlock({
    title: LOAD_ERROR_TITLE,
    tone: 'danger',
    action: button('Retry', { focusKey: RETRY_KEY, onClick: retryLoad }),
  });
}

function retryLoad (): void {
  view = { kind: 'loading' };
  void renderNetworkSection(RETRY_KEY);
}

function refreshButton (): HTMLButtonElement {
  return button('Refresh', { focusKey: REFRESH_KEY, onClick: () => void renderNetworkSection(REFRESH_KEY) });
}

function clearControl (): HTMLElement {
  if (clearPending) return clearConfirm();
  return button('Clear', { focusKey: CLEAR_KEY, onClick: askClear });
}

function clearConfirm (): HTMLElement {
  return inlineConfirm({
    question: CLEAR_QUESTION,
    confirmLabel: 'Clear',
    groupLabel: 'Confirm clear network usage',
    pendingKey: CLEAR_KEY,
    onConfirm: confirmClear,
    onCancel: cancelClear,
  });
}

function askClear (): void {
  clearPending = true;
  void renderNetworkSection(`cancel-${CLEAR_KEY}`);
}

function cancelClear (): void {
  clearPending = false;
  void renderNetworkSection(CLEAR_KEY);
}

async function confirmClear (): Promise<void> {
  clearPending = false;
  try {
    await clearNetworkUsage();
    clearFailed = false;
  } catch {
    clearFailed = true;
  }
  await renderNetworkSection(clearFailed ? TRY_AGAIN_KEY : REFRESH_KEY);
}

function setAutoRefresh (enabled: boolean): void {
  autoRefresh = enabled;
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = enabled ? setInterval(refreshWhenShown, AUTO_REFRESH_INTERVAL_MS) : undefined;
  void renderNetworkSection(AUTO_REFRESH_KEY);
}

function refreshWhenShown (): void {
  if (!requireElement(NETWORK_SECTION_ID).classList.contains('active')) {
    stopWatchingOpenTabs?.();
    stopWatchingOpenTabs = undefined;
    return;
  }
  void renderNetworkSection();
}

function refreshAfterOpenTabsChange (): void {
  clearTimeout(openTabsDebounceTimer);
  openTabsDebounceTimer = setTimeout(refreshWhenShown, OPEN_TABS_DEBOUNCE_MS);
}

onNetworkMonitoringChanged(refreshWhenShown);
