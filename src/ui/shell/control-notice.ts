import browser from 'webextension-polyfill'
import type { ProxyControlState } from '@customTypes/proxyControl'
import { controlNoticeFor, controlWarningCopy } from '@utils/controlNotice'
import type { ControlNotice, NotInEffectState } from '@utils/controlNotice'
import { button } from '../components/button'
import { banner, statusLine } from '../components/feedback'
import { element, replaceContent, requireElement } from '../dom'
import { onProxyControlStateChanged, readProxyControlState } from '../proxyControlState'

const SLOT_ID = 'controlBanner'
const RESTORED_TEXT = 'GeoBypass is routing again.'
const EXTENSIONS_PAGE_URL = 'chrome://extensions'

let previousState: ProxyControlState | undefined

export async function mountControlNotice (): Promise<void> {
  onProxyControlStateChanged(state => showNotice(state))
  showNotice(await readProxyControlState())
}

function showNotice (state: ProxyControlState | undefined): void {
  const notice = controlNoticeFor(previousState, state)
  if (state !== undefined) previousState = state
  replaceContent(requireElement(SLOT_ID), noticeNodes(notice))
}

function noticeNodes (notice: ControlNotice): Node[] {
  if (notice.kind === 'warning') return [warningBanner(notice.state)]
  if (notice.kind === 'restored') return [statusLine(RESTORED_TEXT)]
  return []
}

function warningBanner (state: NotInEffectState): HTMLDivElement {
  const copy = controlWarningCopy(state)
  return banner({
    tone: 'danger',
    text: element('div', {}, element('strong', {}, copy.title), element('p', {}, copy.body)),
    action: copy.actionLabel === undefined ? undefined : button(copy.actionLabel, { onClick: () => void openExtensionsPage() }),
  })
}

async function openExtensionsPage (): Promise<void> {
  await browser.tabs.create({ url: EXTENSIONS_PAGE_URL })
}
