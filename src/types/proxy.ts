import { ProxyId, ProxyType } from '@customTypes/generic'
import { Matcher } from 'browser-extension-url-match/dist/types'
import { DIRECT_PROXY_ID } from '@constant/proxy'

export type ProxyConfig = {
  type: ProxyType;
  proxyDNS: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  failoverTimeout?: number;
}

export type ProxyListItem = ProxyConfig & {
  id: ProxyId;
  label?: string;
  notifyIfDown?: boolean;
}

export type ProxyListRuntimeItem = ProxyListItem & {
  downNotification?: number;
}

export type RuleProxyId = ProxyId | typeof DIRECT_PROXY_ID;

export type ProxyRule = {
  active: boolean;
  name: string;
  match: string[];
  bypassUrlPatterns?: string[];
  bypassResourceTypes?: string[];
  staticExtensions?: string;
  forceProxyUrlPatterns?: string[];
  fallbackDirect?: boolean;
  proxyId: RuleProxyId;
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
