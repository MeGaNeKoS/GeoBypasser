import browser from 'webextension-polyfill'
import type { ProxyControlState } from '@customTypes/proxyControl'
import { ProxyControlChangedMessageSchema } from '@schemas/messages'
import { supportsProxyOnRequest } from '@utils/env'

type ProxyControlResponse = { state: ProxyControlState } | null | undefined

let pushedState: ProxyControlState | undefined

export async function readProxyControlState (): Promise<ProxyControlState | undefined> {
  if (supportsProxyOnRequest) return undefined
  if (pushedState !== undefined) return pushedState
  const response = await browser.runtime.sendMessage({ type: 'getProxyControl' }) as ProxyControlResponse
  return response?.state
}

export function onProxyControlStateChanged (listener: (state: ProxyControlState) => void): void {
  if (supportsProxyOnRequest) return
  browser.runtime.onMessage.addListener((message: unknown) => {
    const changed = ProxyControlChangedMessageSchema.safeParse(message)
    if (!changed.success) return
    pushedState = changed.data.state
    listener(pushedState)
  })
}
