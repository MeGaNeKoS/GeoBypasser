import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyId } from '@customTypes/generic'
import type { KeepAliveTabListeners } from '@core/keepAlive'
import { APP_NAME } from '@constant/defaults'
import { STORAGE_KEYS, TAB_PROXY_MAP } from '@constant/storageKeys'
import { sanitizeSection } from '@utils/storage'

export type StorageChanges = Record<string, { newValue?: unknown }>

type ConfigSectionKey = 'proxyList' | 'defaultProxy' | 'fallbackDirect' | 'testProxyUrl' | 'rules' | 'keepAliveRules' | 'perWebsiteOverride'

const CONFIG_SECTION_KEYS: ConfigSectionKey[] = [
  'proxyList',
  'defaultProxy',
  'fallbackDirect',
  'testProxyUrl',
  'rules',
  'keepAliveRules',
  'perWebsiteOverride',
]

const KEEP_ALIVE_SECTION_KEYS: ConfigSectionKey[] = ['keepAliveRules', 'testProxyUrl']

export type ConfigChangePorts = {
  routing: {
    attach: (config: GeoBypassRuntimeSettings, changedKeys?: string[]) => void;
    replaceTabProxyMap: (map: Record<number, ProxyId>) => void;
  };
  keepAlive: {
    restart: (config: GeoBypassRuntimeSettings) => Promise<KeepAliveTabListeners | undefined>;
  };
  installKeepAliveListeners: (listeners: KeepAliveTabListeners | undefined) => void;
}

export function isConfigChange (changes: StorageChanges, areaName: string): boolean {
  const storedKeys: string[] = Object.values(STORAGE_KEYS)
  return areaName === 'local' && Object.keys(changes).some(key => storedKeys.includes(key))
}

export async function applyStorageChanges (
  config: GeoBypassRuntimeSettings,
  changes: StorageChanges,
  areaName: string,
  ports: ConfigChangePorts,
) {
  console.info(`[${APP_NAME}BG] Storage change detected. Area: ${areaName}. Keys: ${Object.keys(changes).join(', ')}.`)

  if (areaName === 'local' && changes[TAB_PROXY_MAP]) {
    ports.routing.replaceTabProxyMap((changes[TAB_PROXY_MAP].newValue ?? {}) as Record<number, ProxyId>)
    console.info(`[${APP_NAME}BG] tabProxyMap updated from storage.`)
  }

  if (areaName !== 'local') return

  const changedKeys = applySectionChanges(config, changes)
  if (!changedKeys.length) return

  ports.routing.attach(config, changedKeys)
  if (changedKeys.some(key => KEEP_ALIVE_SECTION_KEYS.includes(key))) {
    ports.installKeepAliveListeners(await ports.keepAlive.restart(config))
  }
  console.info(`[${APP_NAME}BG] Handlers updated after config change.`)
}

function applySectionChanges (config: GeoBypassRuntimeSettings, changes: StorageChanges): ConfigSectionKey[] {
  const changedKeys: ConfigSectionKey[] = []
  for (const section of CONFIG_SECTION_KEYS) {
    const change = changes[STORAGE_KEYS[section]]
    if (!change) continue
    setConfigSection(config, section, sanitizeSection(STORAGE_KEYS[section], change.newValue))
    changedKeys.push(section)
  }
  return changedKeys
}

function setConfigSection<K extends ConfigSectionKey> (
  config: GeoBypassRuntimeSettings,
  section: K,
  value: GeoBypassRuntimeSettings[K],
) {
  config[section] = value
}
