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
  keepAlive?: boolean;
};

export type ProxyListItem = ProxyConfig & {
  id: proxyId;
  label?: string;
};

export type ProxyRule = {
  active: boolean;
  name: string;
  match: string[];
  bypassUrlPatterns?: string[];
  bypassRequestTypes?: string[];
  staticExtensions?: string;
  forceProxyUrlPatterns?: string[];
  fallbackDirect?: boolean;
  proxyId: string;
};

export type RuntimeProxyRule = ProxyRule & {
  compiledMatch?: Matcher[];
  compiledBypassUrlPatterns?: Matcher[];
  compiledForceProxyUrlPatterns?: Matcher[];
  compiledStaticExtensions?: RegExp;
};