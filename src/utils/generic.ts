import type { GeoBypassSettings } from '@customTypes/settings'

import { Matcher } from 'browser-extension-url-match/dist/types'

export function matchPatternList (url: string, compiledMatchers: Matcher[]): boolean {
  return compiledMatchers.some(matcher => matcher.match(url))
}

export function getAllMatchUrls (config: GeoBypassSettings): string[] {
  return config.rules.flatMap(rule => rule.match)
}

export function matchHostname (hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const domain = pattern.slice(2)
    return hostname.endsWith('.' + domain)
  }

  return hostname === pattern
}

export function getHostname (url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export async function fetchWithTimeout (url: URL, options: RequestInit = {}, timeout = 5000) {
  const controller = new AbortController()

  const timer = setTimeout(
    () => {
      const abortError = new Error(`Connection timed out (proxy did not respond within ${timeout / 1000} seconds)`)
      abortError.name = 'AbortError'
      controller.abort(abortError)
    }, timeout)
  options.signal = controller.signal
  try {
    return await fetch(url, options)
  } finally {
    clearTimeout(timer)
  }
}

export type KeepAliveState = {
  activeTabs: Map<string, Set<number>>;
  interval: ReturnType<typeof setInterval> | null;
  testUrl: string;
};
