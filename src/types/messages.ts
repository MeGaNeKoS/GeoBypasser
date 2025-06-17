import { ProxyId } from './generic'

export type SetTabProxyMessage = {
  type: 'setTabProxy';
  tabId: number;
  proxyId: ProxyId;
}

export type ClearTabProxyMessage = {
  type: 'clearTabProxy';
  tabId: number;
}

export type TabProxyMessage = SetTabProxyMessage | ClearTabProxyMessage

export type MonitorNetworkMessage = {
  type: 'monitorTabNetwork';
  tabId: number;
}

export type UnmonitorNetworkMessage = {
  type: 'unmonitorTabNetwork';
  tabId: number;
}

export type IsMonitoredMessage = {
  type: 'isTabNetworkMonitored';
  tabId: number;
}

export type DevtoolsNetworkDataMessage = {
  type: 'devtoolsNetworkData';
  tabId: number;
  url: string;
  sentSize: number;
  receivedSize: number;
}

export type NetworkMessage =
  | { type: 'getNetworkStats' }
  | { type: 'clearNetworkStats' }
  | MonitorNetworkMessage
  | UnmonitorNetworkMessage
  | IsMonitoredMessage
  | DevtoolsNetworkDataMessage
;
