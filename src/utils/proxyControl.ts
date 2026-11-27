import type { Types } from 'webextension-polyfill'
import type { ProxyControlState } from '@customTypes/proxyControl'

const PROXY_CONTROL_STATE_BY_LEVEL: Record<Types.LevelOfControl, ProxyControlState> = {
  controlled_by_this_extension: 'active',
  controllable_by_this_extension: 'available',
  controlled_by_other_extensions: 'overridden',
  not_controllable: 'unavailable',
}

export function proxyControlStateFor (levelOfControl: Types.LevelOfControl): ProxyControlState {
  return PROXY_CONTROL_STATE_BY_LEVEL[levelOfControl]
}

export function canApplyPac (state: ProxyControlState): boolean {
  return state === 'available'
}
