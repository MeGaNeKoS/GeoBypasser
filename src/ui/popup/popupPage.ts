import browser from 'webextension-polyfill'
import { isAndroidUserAgent } from '@utils/env'
import { iconButton } from '../components/button'
import { installSprite } from '../icons'
import { replaceContent, requireElement } from '../dom'
import { onProxyControlStateChanged, readProxyControlState } from '../proxyControlState'
import { renderControlWarning } from './popupControl'
import { readPopupContext } from './popupContext'
import { mountMonitorRow } from './popupMonitor'
import { mountRules } from './popupRules'
import { mountThisTab } from './popupThisTab'

const FULL_HEIGHT_CLASS = 'popup--full'

export async function mountPopup (): Promise<void> {
  installSprite()
  if (isAndroidUserAgent(navigator.userAgent)) document.body.classList.add(FULL_HEIGHT_CLASS)

  const context = await readPopupContext()
  const thisTab = mountThisTab(requireElement('thisTab'), context)
  const controlSlot = requireElement('controlBanner')
  renderControlWarning(controlSlot, await readProxyControlState())
  onProxyControlStateChanged(state => {
    renderControlWarning(controlSlot, state)
    void thisTab.refresh()
  })
  void mountMonitorRow(requireElement('monitorRow'), context)
  mountRules(requireElement('rulesBlock'))

  requireElement('openDashboard').addEventListener('click', () => void browser.runtime.openOptionsPage())
  replaceContent(requireElement('closeSlot'), [iconButton('close', 'Close', () => window.close())])
}
