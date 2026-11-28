import { DIRECT_PROXY_ID } from '@constant/proxy'
import type { ProxyRule } from '@customTypes/proxy'
import type { PopupRuleRow, PopupScope } from '@utils/popupView'
import { canSaveOverride, canToggleRule } from '@utils/saveDecisions'
import { isRuleActive } from '@utils/usable'
import { isValidRule } from '@utils/validity'

export type PopupTarget = {
  scope: PopupScope
  tabId: number | undefined
  host: string | undefined
}

export type ProxyChange =
  | { kind: 'setTabProxy'; tabId: number; proxyId: string }
  | { kind: 'clearTabProxy'; tabId: number }
  | { kind: 'setSiteProxy'; host: string; proxyId: string }
  | { kind: 'clearSiteProxy'; host: string }
  | { kind: 'none' }

const NO_CHANGE: ProxyChange = { kind: 'none' }

export function planSetProxy (target: PopupTarget, proxyId: string): ProxyChange {
  if (target.scope === 'tab') {
    return target.tabId === undefined ? NO_CHANGE : { kind: 'setTabProxy', tabId: target.tabId, proxyId }
  }
  if (target.host === undefined || !canSaveOverride(target.host, proxyId)) return NO_CHANGE
  return { kind: 'setSiteProxy', host: target.host, proxyId }
}

export function planClearProxy (target: PopupTarget): ProxyChange {
  if (target.scope === 'tab') {
    return target.tabId === undefined ? NO_CHANGE : { kind: 'clearTabProxy', tabId: target.tabId }
  }
  return target.host === undefined ? NO_CHANGE : { kind: 'clearSiteProxy', host: target.host }
}

export function canTestProxyId (proxyId: string): boolean {
  return proxyId !== DIRECT_PROXY_ID
}

export function ruleListWithActive (list: ProxyRule[], position: number, active: boolean): ProxyRule[] | undefined {
  if (!canToggleRule({ ...list[position], active })) return undefined
  return list.map((rule, index) => (index === position ? { ...rule, active } : rule))
}

export function isRowStillAt (list: unknown[], row: PopupRuleRow): boolean {
  const rule: unknown = list[row.position]
  return isValidRule(rule) && rule.name === row.name && isRuleActive(rule) === row.active
}
