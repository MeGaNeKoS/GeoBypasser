import { GeoBypassSettings } from '@customTypes/settings'

export const DEFAULT_SETTINGS: GeoBypassSettings = {
  proxyList: [],
  defaultProxy: undefined,
  fallbackDirect: true,
  rules: [],
}

export const APP_NAME = 'GeoBypass'