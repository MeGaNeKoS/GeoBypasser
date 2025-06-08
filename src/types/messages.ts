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
