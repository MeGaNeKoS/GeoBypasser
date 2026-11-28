import type { ProxyControlState } from '@customTypes/proxyControl'

export type ControlNotice =
  | { kind: 'none' }
  | { kind: 'warning'; state: NotInEffectState }
  | { kind: 'restored' }

export type NotInEffectState = Extract<ProxyControlState, 'overridden' | 'unavailable'>

export type ControlWarningCopy = {
  title: string
  body: string
  actionLabel?: string
}

const IN_EFFECT_STATES: readonly ProxyControlState[] = ['active', 'available']
const OTHER_EXTENSION_COPY: ControlWarningCopy = {
  title: 'GeoBypass is not routing your traffic',
  body: "Another extension controls this browser's proxy settings, so your proxies, rules and site proxies are not in effect. Turn off or remove the other proxy extension on the extensions page (chrome://extensions). This message clears by itself once GeoBypass is back in control.",
  actionLabel: 'Open extensions page',
}
const POLICY_COPY: ControlWarningCopy = {
  title: 'GeoBypass is not routing your traffic',
  body: "A browser policy controls this browser's proxy settings, so your proxies, rules and site proxies are not in effect. This is usually set by your organisation or by other software on this device. GeoBypass cannot change it. Ask whoever manages this browser, or check the policy page (chrome://policy).",
}

export function controlNoticeFor (previous: ProxyControlState | undefined, current: ProxyControlState | undefined): ControlNotice {
  if (isNotInEffect(current)) return { kind: 'warning', state: current }
  if (previous !== undefined && isNotInEffect(previous) && current !== undefined && IN_EFFECT_STATES.includes(current)) {
    return { kind: 'restored' }
  }
  return { kind: 'none' }
}

export function controlWarningCopy (state: NotInEffectState): ControlWarningCopy {
  return state === 'overridden' ? OTHER_EXTENSION_COPY : POLICY_COPY
}

function isNotInEffect (state: ProxyControlState | undefined): state is NotInEffectState {
  return state === 'overridden' || state === 'unavailable'
}
