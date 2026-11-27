import type { GeoBypassRuntimeSettings } from '@customTypes/settings'
import type { ProxyId } from '@customTypes/generic'
import type { KeepAliveTabListeners } from '@core/keepAlive'
import { APP_NAME } from '@constant/defaults'
import { STORAGE_KEYS, TAB_PROXY_MAP } from '@constant/storageKeys'
import { settingsFromSections, type StoredSectionKey, type StoredSections } from '@utils/storage'

export type StorageChanges = Record<string, { newValue?: unknown }>

export type ConfigState = {
  sections: StoredSections;
  settings: GeoBypassRuntimeSettings;
}

const CONFIG_SECTION_KEYS: StoredSectionKey[] = Object.values(STORAGE_KEYS)

const KEEP_ALIVE_SECTION_KEYS: StoredSectionKey[] = [STORAGE_KEYS.keepAliveRules, STORAGE_KEYS.testProxyUrl]

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

export function createConfigState (sections: StoredSections): ConfigState {
  return { sections, settings: settingsFromSections(sections) }
}

export function applySectionChanges (state: ConfigState, changes: StorageChanges, areaName: string): StoredSectionKey[] {
  if (areaName !== 'local') return []
  const changedKeys = CONFIG_SECTION_KEYS.filter(key => changes[key])
  if (!changedKeys.length) return changedKeys
  for (const key of changedKeys) state.sections[key] = changes[key].newValue
  state.settings = settingsFromSections(state.sections)
  return changedKeys
}

export async function applyStorageChanges (
  state: ConfigState,
  changes: StorageChanges,
  areaName: string,
  ports: ConfigChangePorts,
) {
  console.info(`[${APP_NAME}BG] Storage change detected. Area: ${areaName}. Keys: ${Object.keys(changes).join(', ')}.`)

  if (areaName === 'local' && changes[TAB_PROXY_MAP]) {
    ports.routing.replaceTabProxyMap((changes[TAB_PROXY_MAP].newValue ?? {}) as Record<number, ProxyId>)
    console.info(`[${APP_NAME}BG] tabProxyMap updated from storage.`)
  }

  const changedKeys = applySectionChanges(state, changes, areaName)
  if (!changedKeys.length) return

  ports.routing.attach(state.settings, changedKeys)
  if (changedKeys.some(key => KEEP_ALIVE_SECTION_KEYS.includes(key))) {
    ports.installKeepAliveListeners(await ports.keepAlive.restart(state.settings))
  }
  console.info(`[${APP_NAME}BG] Handlers updated after config change.`)
}
