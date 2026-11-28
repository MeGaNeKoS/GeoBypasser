import browser from 'webextension-polyfill'
import type { ProxyControlState } from '@customTypes/proxyControl'
import { ProxyControlChangedMessageSchema } from '@schemas/messages'
import { supportsProxyOnRequest } from '@utils/env'

type ProxyControlResponse = { state: ProxyControlState } | null | undefined

export async function readProxyControlState (): Promise<ProxyControlState | undefined> {
  if (supportsProxyOnRequest) return undefined
  const response = await browser.runtime.sendMessage({ type: 'getProxyControl' }) as ProxyControlResponse
  return response?.state
}

export function onProxyControlStateChanged (listener: (state: ProxyControlState) => void): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const changed = ProxyControlChangedMessageSchema.safeParse(message)
    if (changed.success) listener(changed.data.state)
  })
}
