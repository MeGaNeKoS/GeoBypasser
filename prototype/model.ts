export type Browser = 'firefox' | 'chrome'

export type ListState = 'populated' | 'empty' | 'loading' | 'error'

export type ThemeChoice = 'system' | 'light' | 'dark'

export type ProxyControl = 'geobypass' | 'other-extension' | 'policy'

export type PrototypeState = {
  browser: Browser;
  listState: ListState;
  theme: ThemeChoice;
  proxyControl: ProxyControl;
  saveFailed: boolean;
}

export const DIRECT_ID = 'direct'

const MATCH_PATTERN = /^(\*|[a-z]+):\/\/\S+$/i

export function isMatchPattern (pattern: string): boolean {
  return MATCH_PATTERN.test(pattern)
}

export type ProxyType = 'http' | 'socks5'

export type ProxyEntry = {
  id: string;
  label: string;
  type: ProxyType;
  host: string;
  port: string;
  username: string;
  password: string;
  notify: boolean;
  resolveDnsThroughProxy: boolean;
  failoverTimeout: string;
  faults: string[];
  notices: string[];
}

export type RuleExceptions = {
  bypassUrls: string[];
  bypassTypes: string[];
  staticExtensions: string;
  forceUrls: string[];
}

export type RuleEntry = {
  id: string;
  name: string;
  active: boolean;
  proxyId: string;
  matchPatterns: string[];
  fallbackDirect: boolean;
  exceptions: RuleExceptions;
  faults: string[];
  notices: string[];
}

export type SiteEntry = {
  id: string;
  domain: string;
  proxyId: string;
  faults: string[];
}

export type KeepAliveEntry = {
  id: string;
  proxyId: string;
  active: boolean;
  tabPatterns: string[];
  testUrl: string;
  faults: string[];
  notices: string[];
}

export type DefaultSettings = {
  defaultProxyId: string;
  fallbackDirect: boolean;
  testUrl: string;
}

export type NetworkNode = {
  name: string;
  sent: string;
  received: string;
  children: NetworkNode[];
}
