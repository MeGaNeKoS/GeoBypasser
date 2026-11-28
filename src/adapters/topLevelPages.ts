import browser from 'webextension-polyfill'
import type { NetworkMonitor } from '@core/networkMonitor'
import { MAIN_FRAME_RESOURCE_TYPE, pageHostFor } from '@utils/networkUsage'

export type PageHostDetails = {
  tabId: number;
  url: string;
  type: string;
  documentUrl?: string;
  initiator?: string;
};

export function registerTopLevelPageTracking (monitor: NetworkMonitor) {
  browser.webRequest.onBeforeRequest.addListener(
    details => monitor.noteTopLevelPage(details.tabId, details.url),
    { urls: ['<all_urls>'], types: [MAIN_FRAME_RESOURCE_TYPE] },
  )
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) monitor.noteTopLevelPage(tabId, changeInfo.url)
  })
}

export function pageHostOfRequest (monitor: NetworkMonitor, details: PageHostDetails): string {
  return pageHostFor({
    requestUrl: details.url,
    resourceType: details.type,
    documentUrl: details.documentUrl,
    initiator: details.initiator,
    tabPageUrl: monitor.topLevelPageUrlOf(details.tabId),
  })
}
