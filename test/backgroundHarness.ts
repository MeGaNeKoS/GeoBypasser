import { jest } from '@jest/globals'
import { browser } from './setup'

export type BackgroundName = 'firefox' | 'chrome'

type AuthListener = (details: unknown) => unknown

const BACKGROUND_PATHS: Record<BackgroundName, string> = {
  firefox: '../src/background.firefox',
  chrome: '../src/background.chrome',
}

let chromeAuthListeners: AuthListener[] = []

export async function settle () {
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

function resetBrowserEvents () {
  const events = [
    browser.storage.onChanged,
    browser.webRequest.onAuthRequired,
    browser.webRequest.onBeforeSendHeaders,
    browser.webRequest.onCompleted,
    browser.webRequest.onErrorOccurred,
    browser.proxy.onRequest,
    browser.proxy.onError,
    browser.runtime.onMessage,
    browser.tabs.onRemoved,
    browser.tabs.onUpdated,
    browser.tabs.onActivated,
  ]
  events.forEach(event => { event._listeners.length = 0 })
}

export function storeLocally (values: Record<string, unknown>) {
  browser.storage.local.get.mockImplementation(async (keys: unknown) => {
    if (typeof keys === 'string') return {}
    const wanted = Array.isArray(keys) ? keys as string[] : Object.keys(values)
    return Object.fromEntries(wanted.filter(key => key in values).map(key => [key, values[key]]))
  })
}

export async function startBackground (name: BackgroundName) {
  resetBrowserEvents()
  chromeAuthListeners = []
  ;(global as any).chrome = {
    webRequest: { onAuthRequired: { addListener: (listener: AuthListener) => { chromeAuthListeners.push(listener) } } },
  }
  jest.resetModules()
  await import(BACKGROUND_PATHS[name])
  await settle()
}

export function authChallengeListener (name: BackgroundName): AuthListener {
  const listeners = name === 'firefox' ? browser.webRequest.onAuthRequired._listeners : chromeAuthListeners
  return listeners[0]
}

export function storageChangeListeners (): Array<(changes: unknown, areaName: string) => unknown> {
  return browser.storage.onChanged._listeners
}
