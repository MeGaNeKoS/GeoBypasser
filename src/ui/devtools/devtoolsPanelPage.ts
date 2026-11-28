import browser from 'webextension-polyfill'
import { devtoolsPanelCopy, devtoolsPanelStateFor, type DevtoolsPanelState } from '@utils/devtoolsPanel'
import { readTabNetworkMonitored } from '../networkMonitorState'

const PANEL_REFRESH_MS = 2000

export async function mountDevtoolsPanel (status: HTMLElement): Promise<void> {
  showPanelState(status, 'loading')
  const tabId = inspectedTabId()
  if (tabId === undefined) {
    showPanelState(status, 'error')
    return
  }
  const refresh = async () => showPanelState(status, devtoolsPanelStateFor(await readTabNetworkMonitored(tabId)))
  await refresh()
  setInterval(() => void refresh(), PANEL_REFRESH_MS)
}

function showPanelState (status: HTMLElement, state: DevtoolsPanelState): void {
  status.textContent = devtoolsPanelCopy(state)
  status.dataset.state = state
}

function inspectedTabId (): number | undefined {
  const devtools: typeof browser.devtools | undefined = browser.devtools
  return devtools?.inspectedWindow.tabId
}
