import type { ProxyControlState } from '@customTypes/proxyControl'
import type { NotInEffectState } from '@utils/controlNotice'
import { popupControlWarning } from '@utils/popupView'
import { button } from '../components/button'
import { banner } from '../components/feedback'
import { element, replaceContent } from '../dom'
import { openExtensionsPage } from '../shell/control-notice'

export function notInEffectStateOf (state: ProxyControlState | undefined): NotInEffectState | undefined {
  return state === 'overridden' || state === 'unavailable' ? state : undefined
}

export function renderControlWarning (slot: HTMLElement, state: ProxyControlState | undefined): void {
  const notInEffect = notInEffectStateOf(state)
  if (notInEffect === undefined) {
    replaceContent(slot, [])
    return
  }
  const warning = popupControlWarning(notInEffect)
  replaceContent(slot, [banner({
    tone: 'danger',
    text: element('p', {}, warning.message),
    action: warning.actionLabel === undefined ? undefined : button(warning.actionLabel, { onClick: () => void openExtensionsPage() }),
  })])
}
