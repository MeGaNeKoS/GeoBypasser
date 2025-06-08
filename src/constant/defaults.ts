import { GeoBypassSettings } from '@customTypes/settings'

export const DEFAULT_SETTINGS: GeoBypassSettings = {
  proxyList: [],
  defaultProxy: undefined,
  fallbackDirect: true,
  testProxyUrl: 'https://www.google.com/',
  rules: [],
  perWebsiteOverride: {},
}

export const APP_NAME = 'GeoBypass'
