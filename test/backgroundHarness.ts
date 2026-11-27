import { jest } from '@jest/globals'
import { browser } from './setup'

export type BackgroundName = 'firefox' | 'chrome'

type AuthListener = (details: unknown) => unknown
type ChromeAuthListener = (details: unknown, respond: (response: unknown) => void) => void

const BACKGROUND_PATHS: Record<BackgroundName, string> = {
  firefox: '../src/background.firefox',
  chrome: '../src/background.chrome',
}

let chromeAuthListeners: ChromeAuthListener[] = []

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
    const wanted = requestedKeys(keys, values)
    return Object.fromEntries(wanted.filter(key => key in values).map(key => [key, values[key]]))
  })
}

function requestedKeys (keys: unknown, values: Record<string, unknown>): string[] {
  if (typeof keys === 'string') return [keys]
  return Array.isArray(keys) ? keys as string[] : Object.keys(values)
}

export async function startBackground (name: BackgroundName) {
  resetBrowserEvents()
  chromeAuthListeners = []
  ;(global as any).chrome = {
    webRequest: { onAuthRequired: { addListener: (listener: ChromeAuthListener) => { chromeAuthListeners.push(listener) } } },
  }
  jest.resetModules()
  await import(BACKGROUND_PATHS[name])
  await settle()
}

export function authChallengeListener (name: BackgroundName): AuthListener {
  if (name === 'firefox') return browser.webRequest.onAuthRequired._listeners[0]
  const [listener] = chromeAuthListeners
  return details => new Promise(respond => listener(details, respond))
}

export function storageChangeListeners (): Array<(changes: unknown, areaName: string) => unknown> {
  return browser.storage.onChanged._listeners
}
