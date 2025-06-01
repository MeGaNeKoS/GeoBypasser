import type { GeoBypassSettings } from '@customTypes/settings'

import { Matcher } from 'browser-extension-url-match/dist/types'

export function matchPatternList (url: string, compiledMatchers: Matcher[]): boolean {
  return compiledMatchers.some(matcher => matcher.match(url))
}

export function getAllMatchUrls (config: GeoBypassSettings): string[] {
  return config.rules.flatMap(rule => rule.match)
}

