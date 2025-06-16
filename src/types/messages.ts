import { proxyId } from './generic'

export type SetTabProxyMessage = {
  type: 'setTabProxy';
  tabId: number;
  proxyId: proxyId;
}

export type ClearTabProxyMessage = {
  type: 'clearTabProxy';
  tabId: number;
}

export type TabProxyMessage = SetTabProxyMessage | ClearTabProxyMessage

export type MonitorNetworkMessage = {
  type: 'monitorTabNetwork'
  tabId: number
}

export type UnmonitorNetworkMessage = {
  type: 'unmonitorTabNetwork'
  tabId: number
}

export type IsMonitoredMessage = {
  type: 'isTabNetworkMonitored'
  tabId: number
}

export type NetworkMessage =
  | { type: 'getNetworkStats' }
  | { type: 'clearNetworkStats' }
  | MonitorNetworkMessage
  | UnmonitorNetworkMessage
  | IsMonitoredMessage
