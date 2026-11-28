import browser from 'webextension-polyfill'
import { supportsProxyOnRequest } from '@utils/env'
import { hostForTabUrl } from '@utils/popupView'

export type PopupContext = {
  tabId: number | undefined
  host: string | undefined
  supportsPerTabProxy: boolean
}

export async function readPopupContext (): Promise<PopupContext> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return {
    tabId: tab?.id,
    host: hostForTabUrl(tab?.url),
    supportsPerTabProxy: supportsProxyOnRequest,
  }
}
