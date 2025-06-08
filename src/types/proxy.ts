import { proxyId, proxyType } from '@customTypes/generic'
import { Matcher } from 'browser-extension-url-match/dist/types'

export type ProxyConfig = {
  type: proxyType;
  proxyDNS: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  failoverTimeout?: number;
}

export type ProxyListItem = ProxyConfig & {
  id: proxyId;
  label?: string;
  notifyIfDown?: boolean;
}

export type ProxyListRuntimeItem = ProxyListItem & {
  downNotification?: number;
}

export type ProxyRule = {
  active: boolean;
  name: string;
  match: string[];
  bypassUrlPatterns?: string[];
  bypassResourceTypes?: string[];
  staticExtensions?: string;
  forceProxyUrlPatterns?: string[];
  fallbackDirect?: boolean;
  proxyId: string;
}

export type RuntimeProxyRule = ProxyRule & {
  compiledMatch?: Matcher;
  compiledBypassUrlPatterns?: Matcher;
  compiledForceProxyUrlPatterns?: Matcher;
  compiledStaticExtensions?: RegExp;
}

export type KeepAliveProxyRule = Record<string, {
  active: boolean;
  tabUrls: string[];
  testProxyUrl?: string;
}>

export type ProxyTestResult =
  | { success: true; proxy: string }
  | { success: false; error: string; proxy: string }
