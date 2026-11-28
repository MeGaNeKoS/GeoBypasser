import browser from 'webextension-polyfill'

export const supportsProxyOnRequest = typeof browser !== 'undefined' &&
  browser.proxy?.onRequest?.addListener instanceof Function

export function isAndroidUserAgent (userAgent: string): boolean {
  return /android/i.test(userAgent)
}
