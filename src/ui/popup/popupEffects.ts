import browser from 'webextension-polyfill'
import type { ProxyRule } from '@customTypes/proxy'
import { isRowStillAt, ruleListWithActive } from '@utils/popupPlan'
import type { ProxyChange } from '@utils/popupPlan'
import type { PopupRuleRow } from '@utils/popupView'
import { overridesWithHost, overridesWithoutHost } from '@utils/usable'
import { changeRuleList } from '../rules/ruleStore'
import { changeSiteMap } from '../sites/siteStore'

export async function applyProxyChange (change: ProxyChange): Promise<void> {
  switch (change.kind) {
    case 'setTabProxy':
      await sendRuntimeMessage({ type: 'setTabProxy', tabId: change.tabId, proxyId: change.proxyId })
      return
    case 'clearTabProxy':
      await sendRuntimeMessage({ type: 'clearTabProxy', tabId: change.tabId })
      return
    case 'setSiteProxy':
      await changeSiteMap(map => overridesWithHost(map, change.host, change.proxyId))
      return
    case 'clearSiteProxy':
      await changeSiteMap(map => overridesWithoutHost(map, change.host))
      return
    case 'none':
      return
  }
}

export function setRuleRowActive (row: PopupRuleRow, active: boolean): Promise<boolean> {
  return changeRuleList((list: ProxyRule[]) => (isRowStillAt(list, row) ? ruleListWithActive(list, row.position, active) : undefined))
}

export async function setTabMonitoring (tabId: number, monitored: boolean): Promise<void> {
  await sendRuntimeMessage({ type: monitored ? 'monitorTabNetwork' : 'unmonitorTabNetwork', tabId })
}

export async function openDashboardAt (hash: string): Promise<void> {
  await browser.tabs.create({ url: `${browser.runtime.getURL('dashboard.html')}${hash}` })
}

async function sendRuntimeMessage (message: Record<string, unknown>): Promise<void> {
  await browser.runtime.sendMessage(message).catch(() => {})
}
