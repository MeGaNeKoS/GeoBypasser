import browser from 'webextension-polyfill'
import { monitorHintFor } from '@utils/popupView'
import { switchControl } from '../components/controls'
import { element, replaceContent } from '../dom'
import type { PopupContext } from './popupContext'
import { setTabMonitoring } from './popupEffects'

export async function mountMonitorRow (slot: HTMLElement, context: PopupContext): Promise<void> {
  const tabId = context.tabId
  const monitored = tabId === undefined ? undefined : await readMonitored(tabId)
  if (tabId === undefined || monitored === undefined) {
    slot.remove()
    return
  }
  const nodes: Node[] = [switchControl('Monitor this tab', monitored, checked => void setTabMonitoring(tabId, checked))]
  const hint = monitorHintFor(context.supportsPerTabProxy)
  if (hint !== undefined) nodes.push(element('p', { class: 'help' }, hint))
  replaceContent(slot, [element('div', { class: 'monitor-row' }, ...nodes)])
}

async function readMonitored (tabId: number): Promise<boolean | undefined> {
  try {
    const reply: unknown = await browser.runtime.sendMessage({ type: 'isTabNetworkMonitored', tabId })
    return reply === true
  } catch {
    return undefined
  }
}
