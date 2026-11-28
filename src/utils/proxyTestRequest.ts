import browser from 'webextension-polyfill'
import type { ProxyTestResult } from '@customTypes/proxy'
import type { TestCustomProxyMessage, TestSavedProxyMessage } from '@customTypes/messages'
import { ProxyTestResultSchema } from '@schemas/proxy'

export type ProxyTestTarget = Omit<TestSavedProxyMessage, 'type'> | Omit<TestCustomProxyMessage, 'type'>

export async function requestProxyTest (target: ProxyTestTarget): Promise<ProxyTestResult> {
  const reply: unknown = await browser.runtime.sendMessage({ type: 'testProxy', ...target })
  return ProxyTestResultSchema.parse(reply)
}
