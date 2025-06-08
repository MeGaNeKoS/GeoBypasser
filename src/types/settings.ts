import { KeepAliveProxyRule, ProxyListItem, ProxyRule, RuntimeProxyRule } from './proxy'
import { proxyId } from '@customTypes/generic'

export type GeoBypassSettings = {
  proxyList: ProxyListItem[];
  defaultProxy?: proxyId;
  fallbackDirect?: boolean;
  rules: ProxyRule[];
  keepAliveRules?: KeepAliveProxyRule;
  testProxyUrl: string;
}

export type GeoBypassRuntimeSettings = Omit<GeoBypassSettings, 'rules'> & {
  rules: RuntimeProxyRule[];
}
