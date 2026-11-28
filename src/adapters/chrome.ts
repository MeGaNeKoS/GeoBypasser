import browser, { Types, WebRequest } from 'webextension-polyfill'
import type { NetworkMonitor, RequestOutcome, RouteForRequest } from '@core/networkMonitor'
import type { ProxyControlState } from '@customTypes/proxyControl'
import { APP_NAME } from '@constant/defaults'
import { pageHostOfRequest, registerTopLevelPageTracking } from './topLevelPages'

export { readStoredSections } from '@utils/storage'

type ProxyAuthListener = (
  details: chrome.webRequest.OnAuthRequiredDetails,
  respond: (response: chrome.webRequest.BlockingResponse) => void,
) => void

export function registerChromeProxyAuth (listener: ProxyAuthListener) {
  chrome.webRequest.onAuthRequired.addListener(
    (details, respond) => {
      listener(details, response => respond?.(response))
      return undefined
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking'], // Chrome answers onAuthRequired through the callback, not a returned Promise
  )
}

export function setChromePacScript (pacScript: string) {
  return browser.proxy.settings.set({
    value: {
      mode: 'pac_script',
      pacScript: { data: pacScript },
    },
  })
}

export async function readChromeLevelOfControl (): Promise<Types.LevelOfControl> {
  const setting = await browser.proxy.settings.get({})
  return setting.levelOfControl
}

export function onChromeProxyLevelChanged (listener: (levelOfControl: Types.LevelOfControl) => Promise<void>) {
  browser.proxy.settings.onChange.addListener(details => listener(details.levelOfControl))
}

export async function broadcastChromeProxyControl (state: ProxyControlState) {
  await browser.runtime.sendMessage({ type: 'proxyControlChanged', state })
    .catch(() => console.debug(`[${APP_NAME}BG] No extension page is listening for the proxy control state`))
}

export function broadcastChromeNetworkMonitoring (tabId: number, monitored: boolean): void {
  void browser.runtime.sendMessage({ type: 'networkMonitoringChanged', tabId, monitored })
    .catch(() => console.debug(`[${APP_NAME}BG] No extension page is listening for network monitoring changes`))
}

export function onChromeRuntimeMessage (listener: (message: unknown) => unknown) {
  browser.runtime.onMessage.addListener(listener)
}

export function onChromeStorageChanged (listener: (changes: Record<string, { newValue?: unknown }>, areaName: string) => Promise<void>) {
  browser.storage.onChanged.addListener(listener)
}

export function onChromeTabRemoved (listener: (tabId: number) => void) {
  browser.tabs.onRemoved.addListener(listener)
}

function contentLengthBytes (headers: WebRequest.HttpHeaders | undefined): number | undefined {
  const header = headers?.find(h => h.name.toLowerCase() === 'content-length')
  if (!header) return undefined
  const bytes = parseInt(header.value || '0', 10)
  return isNaN(bytes) ? undefined : bytes
}

export function registerChromeNetworkMonitor (monitor: NetworkMonitor, routeFor: RouteForRequest) {
  registerTopLevelPageTracking(monitor)
  const sentBytesByRequest = new Map<string, number>()
  const takeSentBytes = (requestId: string) => {
    const bytes = sentBytesByRequest.get(requestId) ?? 0
    sentBytesByRequest.delete(requestId)
    return bytes
  }

  function recordWithExpectedRoute (tabId: number, requestId: string, requestUrl: string, outcome: RequestOutcome) {
    if (!monitor.isTabMonitored(tabId)) return
    void routeFor(requestUrl).then(expectedRoute => monitor.recordRequest(tabId, requestId, { ...outcome, expectedRoute }))
  }

  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      if (!monitor.isTabMonitored(details.tabId)) return
      const bytes = contentLengthBytes(details.requestHeaders)
      if (bytes !== undefined) sentBytesByRequest.set(details.requestId, bytes)
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders'],
  )

  browser.webRequest.onCompleted.addListener(
    details => {
      const receivedBytes = contentLengthBytes(details.responseHeaders)
      recordWithExpectedRoute(details.tabId, details.requestId, details.url, {
        pageHost: pageHostOfRequest(monitor, details),
        requestUrl: details.url,
        resourceType: details.type,
        statusCode: details.statusCode,
        fromCache: details.fromCache,
        sentBytes: takeSentBytes(details.requestId),
        receivedBytes: receivedBytes ?? 0,
        receivedSizeKnown: receivedBytes !== undefined,
      })
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  )

  browser.webRequest.onErrorOccurred.addListener(
    details => {
      recordWithExpectedRoute(details.tabId, details.requestId, details.url, {
        pageHost: pageHostOfRequest(monitor, details),
        requestUrl: details.url,
        resourceType: details.type,
        error: details.error,
        fromCache: details.fromCache,
        sentBytes: takeSentBytes(details.requestId),
        receivedBytes: 0,
        receivedSizeKnown: true,
      })
    },
    { urls: ['<all_urls>'] },
  )
}
