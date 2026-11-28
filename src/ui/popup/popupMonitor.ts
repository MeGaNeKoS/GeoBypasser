import { monitorHintFor } from '@utils/popupView'
import { switchControl } from '../components/controls'
import { element, replaceContent } from '../dom'
import { icon } from '../icons'
import { readTabNetworkMonitored } from '../networkMonitorState'
import type { PopupContext } from './popupContext'
import { setTabMonitoring } from './popupEffects'

const MONITOR_LABEL = 'Monitor this tab'

export async function mountMonitorRow (slot: HTMLElement, context: PopupContext): Promise<void> {
  const tabId = context.tabId
  const monitored = tabId === undefined ? undefined : await readTabNetworkMonitored(tabId)
  if (tabId === undefined || typeof monitored !== 'boolean') {
    slot.remove()
    return
  }
  const row = element('div', { class: 'monitor-row' },
    element('span', { class: 'monitor-row__label' }, MONITOR_LABEL),
    switchControl(MONITOR_LABEL, monitored, checked => void setTabMonitoring(tabId, checked)),
  )
  const hint = monitorHintFor(context.supportsPerTabProxy)
  replaceContent(slot, [row, ...(hint === undefined ? [] : [element('p', { class: 'help' }, icon('info'), hint)])])
}
